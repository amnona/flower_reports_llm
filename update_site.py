#!/usr/bin/env python

# update_site.py
# update the flower report site with new flowering reports

import requests
import json
import os
import time
from datetime import datetime
import sys

import argparse
import google.generativeai as genai
from jinja2 import Environment, FileSystemLoader
 
__version__ = "0.1"


def generate_json_with_gemini(reports):
	"""Generates JSON from flowring reports website using the Gemini API.
	
	Parameters:
	-----------
	reports: str
		the reports to process (scraped from the website)
		
	Returns:
	--------
	json_output: str
		the JSON output from the Gemini API
		"""

	if not reports:
		return "No reports to process."

	prompt = f"""
	Extract flower names and locations (into a structed JSON) using the the following website html code (originating from a flowering report website which is in hebrew):

	{reports}

	The JSON format should contain the following fields:
	- flowers: The name of the flower.
	- locations: The location where the flower was found.
	- maps_query_locations: location names formatted for Google Maps queries (e.g. ignoring "near", "between" etc. so more likely to return a valid results when querying Google Maps).
	- date: The date of the observation
	- original_report: The original report text.
	- observer: The name of the person who reported the observation.

	the "flowers" and "locations" fields should be an array of strings (even if only one flower or location is mentioned).

	If a report doesn't have flower or location information, leave the corresponding field empty.
	"""

	print('generate json with gemini')
	try:
		# get the google api key from the environment variable
		gemini_api_key = os.environ.get("GEMINI_API_KEY")

		# Set your Gemini API key
		genai.configure(api_key=gemini_api_key)

		# model = genai.GenerativeModel('gemini-pro')
		model = genai.GenerativeModel("gemini-1.5-flash")
		print('running model')
		response = model.generate_content(prompt)
		print('got response')
		json_output = response.text

		if json_output.startswith("```json"):
			json_output = json_output[7:]
			json_output = json_output[:-4]

		try:
			# Validate JSON output
			parsed_json = json.loads(json_output)
			print('parsed json. total reports: %d' % len(parsed_json))
			return parsed_json
		except json.JSONDecodeError as e:
			print(f"Gemini returned invalid JSON: {e}")
			# print(f"Raw Gemini Output:\n{json_output}") #print the raw output for debugging
			return json_output

	except Exception as e:
		print(f"Error calling Gemini API: {e}")
		return None

def get_lat_lon_from_location(location, key=None):
	'''Get the latitude and longitude of a location using the Google Maps API
	
	Parameters:
	-----------
	location: str
		the location to query
	key: str or None
		the Google Maps API key to use. If None, the key is read from the GOOGLE_MAPS_API_KEY environment variable.
	
	Returns:
	--------
	lat: float
		the latitude of the location
	lon: float
		the longitude of the location
	'''
	from geopy.geocoders import GoogleV3

	if key is None:
		key = os.getenv('MAPS_API_KEY')

	# Initialize the GoogleV3 geocoder with your API key
	geolocator = GoogleV3(api_key=key)
	
	# Geocode the location
	location = geolocator.geocode(location,components={"country": "IL"})
	
	if location:
		return location.latitude, location.longitude
	else:
		return None, None


def process_website(url):
	print('process website')
	"""Processes a website to extract flowering reports and generate JSON.
	
	Parameters:
	-----------
	url: str
		the URL of the website to process
		
	Returns:
	--------
	json_output: json
		the JSON containing the extracted flowering reports
		list of dictionaries, each containing the following fields:
		- flowers: (list of str) The names of the flowers at the location.
		- locations (list of str): The locations where the flowers were found.
		- maps_query_locations (list of str): location names formatted for Google Maps queries (e.g. ignoring "near", "between" etc. so more likely to return a valid results when querying Google Maps).
		- date (str): The date of the observation
		- original_report (str): The original report text.
		- observer (str): The name of the person who reported the observation.
	"""
	try:
		response = requests.get(url)
		response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
		html_content = response.content.decode('utf-8')
	except requests.exceptions.RequestException as e:
		print(f"Error fetching URL: {e}")
		return None

	print('got html content. length: %d' % len(html_content))
	json_output = generate_json_with_gemini(html_content)
	return json_output


def get_latest_reports(num_reports,force=False):
	'''Get the details of a flowering report

	Parameters:
	-----------
	num_reports: int
		the number of reports to retrieve or 0 for all reports
	
	Returns:
	--------
	err: str
		error message, if any
	reports: json
		the JSON containing the extracted flowering reports
		list of dictionaries, each containing the following fields:
		- flowers: (list of str) The names of the flowers at the location.
		- locations (list of str): The locations where the flowers were found.
		- maps_query_locations (list of str): location names formatted for Google Maps queries (e.g. ignoring "near", "between" etc. so more likely to return a valid results when querying Google Maps).
		- date (str): The date of the observation
		- original_report (str): The original report text.
		- observer (str): The name of the person who reported the observation.
	'''
	# scrape the website https://www.wildflowers.co.il/hebrew/flash.asp
	# get the website content
	print('get latest reports')

	# check the creation time of the reports file, and if it is older than 1 hour, reprocess the website
	if not force:
		try:
			file_time = os.path.getmtime('reports.json')
			if time.time() - file_time < 3600:
				print('file is recent. loading from file')
				with open('reports.json', 'r') as f:
					json_result = json.load(f)
				return None, json_result
		except FileNotFoundError:
			print('file not found. processing website')
			pass

	# get the latest report date from the current reports file
	json_result = []
	try:
		with open('reports.json', 'r') as f:
			json_result = json.load(f)
			dates = [x['date'] for x in json_result]
			# convert the dates to datetime objects
			dates = [datetime.strptime(x,'%d/%m/%Y') for x in dates]
			dates.sort(reverse=True)
			latest_date = dates[0]
			print('latest date: %s' % latest_date)
			# delete all reports with the latest date
			json_result = [x for x in json_result if x['date'] != latest_date.strftime('%d/%m/%Y')]
	except FileNotFoundError:
		print('previous reports file not found. processing website')
		latest_date = None

	# get the latest report date from the current reports file
	print('processing website')
	website_url = "https://www.wildflowers.co.il/hebrew/flash.asp/"
	for cpage in range(1,10):
		print('page %d' % cpage)
		website_url = 'https://www.wildflowers.co.il/hebrew/flash.asp?page=%d' % cpage
		cjson_result = process_website(website_url)
		if cjson_result is None:
			break
		# get the latest date from the reports
		dates = [x['date'] for x in cjson_result]
		# convert the dates to datetime objects
		dates = [datetime.strptime(x,'%d/%m/%Y') for x in dates]
		dates.sort(reverse=True)
		# if the latest date are before the latest date in the current reports, stop processing
		if latest_date is not None and dates[0] < latest_date:
			print('latest date in new reports is before latest date in current reports. stopping')
			break
		json_result.extend(cjson_result)

	if len(json_result)==0:
		return "Error processing website", {}

	print('got %d reports' % len(json_result))

	# save the reports to a file
	with open('reports.json', 'w') as f:
		json.dump(json_result, f)

	if num_reports > 0:
		json_result = json_result[:num_reports]
	return None, json_result


def update_site(website_url):
	'''Update the flower report site with new flowering reports
	
	Parameters:
	-----------
	website_url : str
		URL of the website to update
	
	Returns:
	--------
	None
	'''
	print('get map')
 
	coords = []
	report_ids = []
	descriptions = []

	# get the latest flowering reports
	err, reports = get_latest_reports(0)
	if err:
		return "error encountered: %s" % err
	
	print('got %d reports' % len(reports))
	# get the lat and lon for each location
	print('getting coords')
	for creport in reports:
		maps_query_locations = creport['maps_query_locations']
		if len(maps_query_locations) > 0:
			for cloc in maps_query_locations:
				lat, lon = get_lat_lon_from_location(cloc)
				if lat is not None and lon is not None:
					coords.append([lat, lon])
					# convert the flowers to a string for the marker
					cid = ', '.join(creport['flowers'])
					cid += '\n'+str(creport['date'])
					report_ids.append(cid)
					descriptions.append(creport['original_report'])
				else:
					print('location not found: %s' % cloc)
	print('got %d coords' % len(coords))

	# render the map.html template with the variables to the file "map.html"
	# Load the template environment
	env = Environment(loader=FileSystemLoader('./templates'))

	# Load the template
	template = env.get_template('map.html')

	# Render the template with the data
	rendered_html = template.render(coords_list=json.dumps(coords), flower_ids=json.dumps(report_ids), descriptions=json.dumps(descriptions))

	# Save the rendered HTML to a new file
	with open('./static/output_map.html', 'w') as f:
		f.write(rendered_html)
	


def main(argv):
	if os.getenv('MAPS_API_KEY') is None:
		print('MAPS_API_KEY not found in environment variables')
		raise Exception('MAPS_API_KEY not found in environment variables')

	if os.getenv('GEMINI_API_KEY') is None:
		print('GEMINI_API_KEY not found in environment variables')
		raise Exception('GEMINI_API_KEY not found in environment variables')

	parser = argparse.ArgumentParser(description='update_site version %s.' % __version__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
	parser.add_argument('-u', '--url', help='url of the website with the flowering reports', required=True)

	args = parser.parse_args(argv)
	update_site(args.url)


if __name__ == "__main__":
	main(sys.argv[1:])
