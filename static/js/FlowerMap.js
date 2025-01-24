class FlowerMap {
    constructor() {
        console.log("FlowerMap constructor"); // Added this line
        this.map = null;
        this.markerCluster = null;
        this.dateRange = { from: null, to: null };
        this.currentMarkers = [];
        // this.statistics = new FlowerStatistics();
        this.calendarVisible = false;
        this.currentCalendarDate = new Date(); // default to today's date for the calendar
        
        // Initialize the map
        this.initializeMap();
        this.initializeDatePicker();
        flowerMapUtils.tabUtils.initialize();
        
        // Load initial data
        this.loadData();
    }
    
    initializeMap() {
        flowerMapUtils.logger.info('Initializing map');
        
        this.map = L.map('map').setView([31.7683, 35.2137], 8);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        // Initialize marker cluster group
        this.markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });
        
        this.map.addLayer(this.markerCluster);
    }
    
     initializeDatePicker() {
        const datePickerButton = document.getElementById('datePickerButton');
        const calendar = document.getElementById('calendar');
        const clearDates = document.getElementById('clearDates');

        datePickerButton.addEventListener('click', () => {
          this.calendarVisible = !this.calendarVisible;
          this.updateCalendar();
          calendar.classList.toggle('hidden', !this.calendarVisible);
        });

        clearDates.addEventListener('click', () => this.clearDateFilter());

          document.addEventListener('click', (e) => {
            if (!calendar.contains(e.target) && e.target !== datePickerButton) {
                this.calendarVisible = false;
                calendar.classList.add('hidden');
            }
        });
    }
     updateCalendar() {
      const calendarDiv = document.getElementById('calendar');
      calendarDiv.innerHTML = ''; // Clear the previous calendar

      const headerDiv = document.createElement('div');
      headerDiv.className = 'calendar-header';
        
      // Previous Month Button
        const prevMonthButton = document.createElement('button');
        prevMonthButton.textContent = '❮';
        prevMonthButton.className = 'month-button';
        prevMonthButton.onclick = () => {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
            this.updateCalendar();
        };
        headerDiv.appendChild(prevMonthButton);


    // Display Current Month and Year
      const monthYearSpan = document.createElement('span');
      monthYearSpan.textContent = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(this.currentCalendarDate);
      headerDiv.appendChild(monthYearSpan);

       // Next Month Button
        const nextMonthButton = document.createElement('button');
        nextMonthButton.textContent = '❯';
        nextMonthButton.className = 'month-button';
         nextMonthButton.onclick = () => {
             this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
             this.updateCalendar();
        };
        headerDiv.appendChild(nextMonthButton);
      calendarDiv.appendChild(headerDiv);
    
      const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
        dayNames.forEach(day => {
            const dayNameDiv = document.createElement('div');
            dayNameDiv.textContent = day;
            calendarDiv.appendChild(dayNameDiv);
      });
    
      const firstDayOfMonth = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth(), 1);
        const lastDayOfMonth = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 0);

        const daysInMonth = lastDayOfMonth.getDate();
        let dayOfWeek = firstDayOfMonth.getDay();

      for (let i = 0; i < dayOfWeek; i++) {
          const emptyDiv = document.createElement('div');
          calendarDiv.appendChild(emptyDiv);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dayButton = document.createElement('button');
        dayButton.textContent = day;
        dayButton.className = 'day-button';
          const currentDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth(), day);
          
          if (this.dateRange.from && this.dateRange.to) {
              if (currentDate >= this.dateRange.from && currentDate <= this.dateRange.to)
                dayButton.classList.add('selected');
          } else if (this.dateRange.from &&
                     currentDate.getDate() == this.dateRange.from.getDate() &&
                     currentDate.getMonth() == this.dateRange.from.getMonth() &&
                     currentDate.getFullYear() == this.dateRange.from.getFullYear()) {
            dayButton.classList.add('selected');
        }
           
        dayButton.onclick = () => this.handleDateSelect(currentDate);
        calendarDiv.appendChild(dayButton);
      }
    }

    async loadData() {
         try {
            flowerMapUtils.logger.info('Loading flower reports');
            const response = await fetch('./static/reports.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Loaded data:", data); // Added this line
            this.processData(data);
            this.updateLastReportDates();
            // this.statistics.updateStatistics(data, this.dateRange);
            
            flowerMapUtils.logger.info('Data loaded successfully', { count: data.length });
        } catch (error) {
            flowerMapUtils.logger.error('Failed to load data', error);
            this.showError('לא ניתן לטעון את הנתונים. אנא נסה שוב מאוחר יותר.');
        }
    }

    async updateLastReportDates() {
        const files = [
            { path: './static/reports.json', elementId: 'lastReportDateReports' }
        ];

        for (const fileInfo of files) {
          try {
              const response = await fetch(fileInfo.path);
              if (response.ok) {
                const data = await response.json();
                  const lastReport = data.reduce((max, current) => {
                      return new Date(current.date) > new Date(max.date) ? current : max;
                  });
                  const formattedDate = lastReport ? flowerMapUtils.dateUtils.formatDate(lastReport.date) : 'N/A';
                // document.getElementById(fileInfo.elementId).textContent = `עדכון אחרון: ${formattedDate}`;
            } else {
                // document.getElementById(fileInfo.elementId).textContent = "לא ניתן לטעון נתונים";
            }
          } catch (error) {
            flowerMapUtils.logger.error(`Failed to load data for ${fileInfo.path}`, error);
                // document.getElementById(fileInfo.elementId).textContent = "לא ניתן לטעון נתונים";
          }
        }
    }
    
    processData(reports) {
        console.log("Processing data", reports); // Added this line
        this.markerCluster.clearLayers();
        this.currentMarkers = [];
        
        const filteredReports = reports.filter(report => {
            return flowerMapUtils.dateUtils.isDateInRange(report.date, this.dateRange);
        });
        
        console.log("Filtered reports", filteredReports); // Added this line

        filteredReports.forEach(report => {
            const marker = this.createMarker(report);
            this.currentMarkers.push(marker);
            this.markerCluster.addLayer(marker);
        });
        
        flowerMapUtils.logger.info('Markers updated', {
            total: reports.length,
            filtered: filteredReports.length
        });
    }
    
    createMarker(report) {
        const marker = L.marker([report.lat, report.lon]);
        
        const popupContent = `
            <div class="popup-content">
                <h3 class="popup-title">${report.flowers}</h3>
                <p><strong>מיקום:</strong> ${report.locations}</p>
                <p><strong>תאריך:</strong> ${flowerMapUtils.dateUtils.formatDate(report.date)}</p>
                <p><strong>דיווח מקורי:</strong> ${report.original_report}</p>
                <button onclick="flowerMapUtils.shareUtils.shareLocation(${report.lat}, ${report.lon}, '${report.flowers}')" 
                        class="share-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                        <polyline points="16 6 12 2 8 6"></polyline>
                        <line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                    שתף מיקום
                </button>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        return marker;
    }
    
    handleDateSelect(date) {
        if (!this.dateRange.from || this.dateRange.to) {
            // Start new range
            this.dateRange = { from: date, to: null };
            document.getElementById('selectedDateRange').textContent = 
                flowerMapUtils.dateUtils.formatDate(date);
        } else {
            // Complete the range
            if (date < this.dateRange.from) {
                this.dateRange = { from: date, to: this.dateRange.from };
            } else {
                this.dateRange.to = date;
            }
            
            document.getElementById('selectedDateRange').textContent = 
                `${flowerMapUtils.dateUtils.formatDate(this.dateRange.from)} - ${flowerMapUtils.dateUtils.formatDate(this.dateRange.to)}`;
            
             this.calendarVisible = false;
            document.getElementById('calendar').classList.add('hidden');
            this.loadData(); // Reload data with new date range
        }
    };
    
//     // class FlowerMap {
//     // constructor() {
//     //     this.map = null;
//     //     this.markerCluster = null;
//     //     this.dateRange = { from: null, to: null };
//     //     this.currentMarkers = [];
//     //     this.statistics = new FlowerStatistics();
//     //     this.calendarVisible = false;
//     //     this.currentCalendarDate = new Date(); // default to today's date for the calendar
        
//     //     // Initialize the map
//     //     this.initializeMap();
//     //     this.initializeDatePicker();
//     //     flowerMapUtils.tabUtils.initialize();
        
//     //     // Load initial data
//     //     this.loadData();
//     // }
    
//     // initializeMap() {
//     //     flowerMapUtils.logger.info('Initializing map');
        
//     //     this.map = L.map('map').setView([31.7683, 35.2137], 8);
        
//     //     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     //         attribution: '© OpenStreetMap contributors'
//     //     }).addTo(this.map);
        
//     //     // Initialize marker cluster group
//     //     this.markerCluster = L.markerClusterGroup({
//     //         maxClusterRadius: 50,
//     //         spiderfyOnMaxZoom: true,
//     //         showCoverageOnHover: false,
//     //         zoomToBoundsOnClick: true
//     //     });
        
//     //     this.map.addLayer(this.markerCluster);
//     // }
    
//     //  initializeDatePicker() {
//     //     const datePickerButton = document.getElementById('datePickerButton');
//     //     const calendar = document.getElementById('calendar');
//     //     const clearDates = document.getElementById('clearDates');

//     //     datePickerButton.addEventListener('click', () => {
//     //       this.calendarVisible = !this.calendarVisible;
//     //       this.updateCalendar();
//     //       calendar.classList.toggle('hidden', !this.calendarVisible);
//     //     });

//     //     clearDates.addEventListener('click', () => this.clearDateFilter());

//     //       document.addEventListener('click', (e) => {
//     //         if (!calendar.contains(e.target) && e.target !== datePickerButton) {
//     //             this.calendarVisible = false;
//     //             calendar.classList.add('hidden');
//     //         }
//     //     });
//     // }
//     //  updateCalendar() {
//     //   const calendarDiv = document.getElementById('calendar');
//     //   calendarDiv.innerHTML = ''; // Clear the previous calendar

//     //   const headerDiv = document.createElement('div');
//     //   headerDiv.className = 'calendar-header';
        
//     //   // Previous Month Button
//     //     const prevMonthButton = document.createElement('button');
//     //     prevMonthButton.textContent = '❮';
//     //     prevMonthButton.className = 'month-button';
//     //     prevMonthButton.onclick = () => {
//     //         this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
//     //         this.updateCalendar();
//     //     };
//     //     headerDiv.appendChild(prevMonthButton);


//     // // Display Current Month and Year
//     //   const monthYearSpan = document.createElement('span');
//     //   monthYearSpan.textContent = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(this.currentCalendarDate);
//     //   headerDiv.appendChild(monthYearSpan);

//     //    // Next Month Button
//     //     const nextMonthButton = document.createElement('button');
//     //     nextMonthButton.textContent = '❯';
//     //     nextMonthButton.className = 'month-button';
//     //      nextMonthButton.onclick = () => {
//     //          this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
//     //          this.updateCalendar();
//     //     };
//     //     headerDiv.appendChild(nextMonthButton);
//     //   calendarDiv.appendChild(headerDiv);
    
//     //   const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
//     //     dayNames.forEach(day => {
//     //         const dayNameDiv = document.createElement('div');
//     //         dayNameDiv.textContent = day;
//     //         calendarDiv.appendChild(dayNameDiv);
//     //   });
    
//     //   const firstDayOfMonth = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth(), 1);
//     //     const lastDayOfMonth = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 0);

//     //     const daysInMonth = lastDayOfMonth.getDate();
//     //     let dayOfWeek = firstDayOfMonth.getDay();

//     //   for (let i = 0; i < dayOfWeek; i++) {
//     //       const emptyDiv = document.createElement('div');
//     //       calendarDiv.appendChild(emptyDiv);
//     //   }

//     //   for (let day = 1; day <= daysInMonth; day++) {
//     //     const dayButton = document.createElement('button');
//     //     dayButton.textContent = day;
//     //     dayButton.className = 'day-button';
//     //       const currentDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth(), day);
          
//     //       if (this.dateRange.from && this.dateRange.to) {
//     //           if (currentDate >= this.dateRange.from && currentDate <= this.dateRange.to)
//     //             dayButton.classList.add('selected');
//     //       } else if (this.dateRange.from &&
//     //                  currentDate.getDate() == this.dateRange.from.getDate() &&
//     //                  currentDate.getMonth() == this.dateRange.from.getMonth() &&
//     //                  currentDate.getFullYear() == this.dateRange.from.getFullYear()) {
//     //         dayButton.classList.add('selected');
//     //     }
           
//     //     dayButton.onclick = () => this.handleDateSelect(currentDate);
//     //     calendarDiv.appendChild(dayButton);
//     //   }
//     // }

//     // async loadData() {
//     //      try {
//     //         flowerMapUtils.logger.info('Loading flower reports');
//     //         const response = await fetch('./static/reports.json');
            
//     //         if (!response.ok) {
//     //             throw new Error(`HTTP error! status: ${response.status}`);
//     //         }
            
//     //         const data = await response.json();
//     //         console.log("Loaded data:", data); // Added this line
//     //         this.processData(data);
//     //          this.updateLastReportDates();
//     //         this.statistics.updateStatistics(data, this.dateRange);
            
//     //         flowerMapUtils.logger.info('Data loaded successfully', { count: data.length });
//     //     } catch (error) {
//     //         flowerMapUtils.logger.error('Failed to load data', error);
//     //         this.showError('לא ניתן לטעון את הנתונים. אנא נסה שוב מאוחר יותר.');
//     //     }
//     // }

//     async updateLastReportDates() {
//         const files = [
//             { path: './static/reports.json', elementId: 'lastReportDateReports' }
//         ];

//         for (const fileInfo of files) {
//           try {
//               const response = await fetch(fileInfo.path);
//               if (response.ok) {
//                 const data = await response.json();
//                   const lastReport = data.reduce((max, current) => {
//                       return new Date(current.date) > new Date(max.date) ? current : max;
//                   });
//                   const formattedDate = lastReport ? flowerMapUtils.dateUtils.formatDate(lastReport.date) : 'N/A';
//                 document.getElementById(fileInfo.elementId).textContent = `עדכון אחרון: ${formattedDate}`;
//             } else {
//                 document.getElementById(fileInfo.elementId).textContent = "לא ניתן לטעון נתונים";
//             }
//           } catch (error) {
//             flowerMapUtils.logger.error(`Failed to load data for ${fileInfo.path}`, error);
//                 document.getElementById(fileInfo.elementId).textContent = "לא ניתן לטעון נתונים";
//           }
//         }
//     }
    
//     processData(reports) {
//         console.log("Processing data", reports); // Added this line
//         this.markerCluster.clearLayers();
//         this.currentMarkers = [];
        
//         const filteredReports = reports.filter(report => {
//             return flowerMapUtils.dateUtils.isDateInRange(report.date, this.dateRange);
//         });
        
//         console.log("Filtered reports", filteredReports); // Added this line

//         filteredReports.forEach(report => {
//             const marker = this.createMarker(report);
//             this.currentMarkers.push(marker);
//             this.markerCluster.addLayer(marker);
//         });
        
//         flowerMapUtils.logger.info('Markers updated', {
//             total: reports.length,
//             filtered: filteredReports.length
//         });
//     }
    
//     createMarker(report) {
//         const marker = L.marker([report.lat, report.lon]);
        
//         const popupContent = `
//             <div class="popup-content">
//                 <h3 class="popup-title">${report.flowers}</h3>
//                 <p><strong>מיקום:</strong> ${report.locations}</p>
//                 <p><strong>תאריך:</strong> ${flowerMapUtils.dateUtils.formatDate(report.date)}</p>
//                 <p><strong>דיווח מקורי:</strong> ${report.original_report}</p>
//                 <button onclick="flowerMapUtils.shareUtils.shareLocation(${report.lat}, ${report.lon}, '${report.flowers}')" 
//                         class="share-button">
//                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
//                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//                         <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
//                         <polyline points="16 6 12 2 8 6"></polyline>
//                         <line x1="12" y1="2" x2="12" y2="15"></line>
//                     </svg>
//                     שתף מיקום
//                 </button>
//             </div>
//         `;
        
//         marker.bindPopup(popupContent);
//         return marker;
//     }
    
//     handleDateSelect(date) {
//         if (!this.dateRange.from || this.dateRange.to) {
//             // Start new range
//             this.dateRange = { from: date, to: null };
//             document.getElementById('selectedDateRange').textContent = 
//                 flowerMapUtils.dateUtils.formatDate(date);
//         } else {
//             // Complete the range
//             if (date < this.dateRange.from) {
//                 this.dateRange = { from: date, to: this.dateRange.from };
//             } else {
//                 this.dateRange.to = date;
//             }
            
//             document.getElementById('selectedDateRange').textContent = 
//                 `${flowerMapUtils.dateUtils.formatDate(this.dateRange.from)} - ${flowerMapUtils.dateUtils.formatDate(this.dateRange.to)}`;
            
//              this.calendarVisible = false;
//             document.getElementById('calendar').classList.add('hidden');
//             this.loadData(); // Reload data with new date range
//         }
//          this.updateCalendar();
//     }
    
//     clearDateFilter() {
//         this.dateRange = { from: null, to: null };
//         document.getElementById('selectedDateRange').textContent = 'בחר תאריכים';
//         this.loadData();
//          this.updateCalendar();
//         flowerMapUtils.logger.info('Date filter cleared');
//     }
    
//     showError(message) {
//         const errorDiv = document.createElement('div');
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.querySelector('.card-header').appendChild(errorDiv);
//             errorDiv.remove();
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}
// // Initialize the map when the DOM is loaded

// Initialize the map when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.flowerMap = new FlowerMap();
    console.log("FlowerMap initialized"); // Added this line
});

