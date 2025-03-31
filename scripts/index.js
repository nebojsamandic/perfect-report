document.getElementById('processButton').addEventListener('click', () => {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please upload a file first!');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Assume the first sheet contains the report data
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Process the data
        const results = processReportData(jsonData);

        // Display results in the table
        displayResults(results);
    };

    reader.readAsArrayBuffer(file);
});

function processReportData(data) {
    const results = {};
    let currentName = null;

    // Loop through each row in the data
    for (const row of data) {
        if (row.length === 0) continue; // Skip empty rows

        const firstCell = row[0]?.toString().trim();

        // Ignore rows like "Booked Jobs / Move Day ..." or "jobTotalPrice: ..." or "leadCount:"
        if (firstCell?.startsWith("Booked Jobs") || firstCell?.startsWith("jobTotalPrice") || firstCell?.startsWith("leadCount")) continue;

        // Detect a new user name row by checking if it's the first cell (row[0])
        if (row.length === 1 && firstCell && isNaN(firstCell)) {
            currentName = firstCell; // Set the current user to this name
        } else if (currentName && row.length > 1) {
            // Process job rows
            const jobTotalPriceIndex = 10; // Assuming the jobTotalPrice is at index 10 in each row
            const jobTotalPrice = parseFloat(row[jobTotalPriceIndex]) || 0; // Extract job total price

            // If the jobTotalPrice is 0, we can ignore that row for job counting
            if (jobTotalPrice === 0) continue;

            // Using leadId (row[0]) as a unique job identifier for each person
            const jobId = row[0];

            // Initialize the user's results if not already
            if (!results[currentName]) {
                results[currentName] = {
                    count: 0,
                    totalPrice: 0,
                    jobIds: new Set() // Track unique jobIds
                };
            }

            // Only count jobs that haven't been counted yet for this user
            if (!results[currentName].jobIds.has(jobId)) {
                results[currentName].jobIds.add(jobId); // Add jobId to the set to mark it as counted
                results[currentName].count++; // Increment job count
                results[currentName].totalPrice += jobTotalPrice; // Add job price to total
            }
        }
    }

    // Convert results to an array and sort by job count in descending order
    return Object.entries(results)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.count - a.count);
}



function displayResults(results) {
    const table = document.getElementById('resultsTable');
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    for (const { name, count, totalPrice } of results) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${name}</td><td>${count}</td><td>$${totalPrice.toFixed(2)}</td>`;
        tbody.appendChild(row);
    }

    table.style.display = 'table';
}

//  THIS NOT TO BE TOUCHED ABOVE





// Button for processing the source data (Opened and booked jobs by source)
document.getElementById('processSourceButton').addEventListener('click', () => {
    const fileInput = document.getElementById('uploadSource');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please upload a file first!');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        console.log('Workbook Loaded:', workbook);  // Debugging log

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log("JSON Data:", jsonData);  // Debugging log: Check the raw data

        const sourceResults = processSourceData(jsonData);
        console.log("Source Results:", sourceResults);  // Debugging log: Check processed data

        displaySourceResults(sourceResults);
    };

    reader.readAsArrayBuffer(file);
});

function processSourceData(data) {
    const sourceStats = {};

    // Loop through each row in the data
    for (const row of data) {
        if (row.length === 0) continue;  // Skip empty rows

        const source = row[4];  // Source is in column E (index 4)
        const bookedTime = row[2];  // Booked time is in column C (index 2)
        const cfValue = row[9];  // CF value is in column J (index 9)
        const priceValue = row[10];  // Price value is in column K (index 10)

        // Skip rows where source is missing, empty or equal to "source"
        if (!source || source.trim() === "" || source.trim().toLowerCase() === "source") continue;

        // Initialize source stats if not already
        if (!sourceStats[source]) {
            sourceStats[source] = { newLeads: 0, bookedLeads: 0, noPriceLeads: 0, openLeads: 0 };
        }

        // Count New Leads (every row is a new lead for a source)
        sourceStats[source].newLeads++;

        // Count Booked Leads (only if there is any non-empty value in bookedTime)
        if (bookedTime && bookedTime.trim() !== "") {
            sourceStats[source].bookedLeads++;  // Increment booked leads count if there's any value
        }

        // Count No Price Leads (both CF and Price should be 0)
        if (cfValue === 0 && priceValue === 0) {
            sourceStats[source].noPriceLeads++;  // Increment no price leads count
        }

        // Count Open Leads (if bookedTime is empty, but either CF or Price has value)
        if (!bookedTime || bookedTime.trim() === "") {
            if (cfValue !== 0 || priceValue !== 0) {
                sourceStats[source].openLeads++;  // Increment open leads if no bookedTime but CF or Price is available
            }
        }
    }

    // Convert to an array and sort by New Leads in descending order
    return Object.entries(sourceStats)
        .map(([source, stats]) => {
            const totalLeads = stats.bookedLeads + stats.noPriceLeads + stats.openLeads;  // Total is the sum of Booked, No Price, and Open Leads
            
            // Calculate percentages for Booked Leads, No Price Leads, and Open Leads
            const bookedPercentage = totalLeads === 0 ? 0 : (stats.bookedLeads / totalLeads) * 100;
            const noPricePercentage = totalLeads === 0 ? 0 : (stats.noPriceLeads / totalLeads) * 100;
            const openLeadsPercentage = totalLeads === 0 ? 0 : (stats.openLeads / totalLeads) * 100;

            return {
                source,
                newLeads: stats.newLeads,
                bookedLeads: stats.bookedLeads,
                noPriceLeads: stats.noPriceLeads,
                openLeads: stats.openLeads,
                bookedPercentage: bookedPercentage.toFixed(2),
                noPricePercentage: noPricePercentage.toFixed(2),
                openLeadsPercentage: openLeadsPercentage.toFixed(2),
            };
        })
        .sort((a, b) => b.newLeads - a.newLeads);  // Sort by New Leads in descending order
}

// Display the results for source data (New Leads, Open Leads, Booked Leads, No Price Leads with percentages)
function displaySourceResults(results) {
    const table = document.getElementById('sourceResultsTable');
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';  // Clear previous results

    if (results.length === 0) {
        console.log("No results to display.");  // Debug: check if results are empty
    }

    // Add rows to the table for each source
    for (const { source, newLeads, openLeads, bookedLeads, noPriceLeads, bookedPercentage, noPricePercentage, openLeadsPercentage } of results) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${source}</td>
                         <td>${newLeads}</td>
                         <td>${openLeads} (${openLeadsPercentage}%)</td>
                         <td>${bookedLeads} (${bookedPercentage}%)</td>
                         <td>${noPriceLeads} (${noPricePercentage}%)</td>`;  // Adjusted column order
        tbody.appendChild(row);
    }

    table.style.display = 'table';  // Make the table visible
}


    // Get references to the file inputs and process buttons
    const salesFileInput = document.getElementById('upload');
    const sourceFileInput = document.getElementById('uploadSource');
    const processButton = document.getElementById('processButton');
    const processSourceButton = document.getElementById('processSourceButton');

    // Add event listener for Sales Booking file input
    salesFileInput.addEventListener('change', function() {
        if(this.files.length > 0) {
            processButton.style.display = 'block';
        } else {
            processButton.style.display = 'none';
        }
    });

    // Add event listener for Source Booking file input
    sourceFileInput.addEventListener('change', function() {
        if(this.files.length > 0) {
            processSourceButton.style.display = 'block';
        } else {
            processSourceButton.style.display = 'none';
        }
    });

// EV ls for copy of the whole clicked row
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('copyNotification')) {
        const notification = document.createElement('div');
        notification.id = 'copyNotification';
        notification.style.cssText = `
            display: none;
            position: fixed;
            top: 20px;
            right: 20px;
            background-color:rgb(82, 33, 218);  /* Updated to match your design's primary purple */
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
            box-shadow: 0 4px 15px rgba(148, 132, 194, 0.3);
        `;
        document.body.appendChild(notification);
    }

    const tables = document.querySelectorAll('#resultsTable, #sourceResultsTable');
    
    tables.forEach(table => {
        table.addEventListener('click', function(e) {
            if (e.target.tagName === 'TD') {
                const row = e.target.parentElement;
                const cells = row.cells;
                let rowContent = [];
                
                for(let i = 0; i < cells.length; i++) {
                    rowContent.push(cells[i].textContent.trim());
                }
                
                navigator.clipboard.writeText(rowContent.join(' - '))
                    .then(() => {
                        const notification = document.getElementById('copyNotification');
                        notification.textContent = 'Row copied to clipboard!';
                        notification.style.display = 'block';
                        notification.style.opacity = '1';

                        setTimeout(() => {
                            notification.style.opacity = '0';
                            setTimeout(() => {
                                notification.style.display = 'none';
                            }, 300);
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('Failed to copy: ', err);
                    });
            }
        });
    });
});

//side button wheter menu 
document.addEventListener('DOMContentLoaded', function() {
    const sidePanel = document.querySelector('.side-panel');
    const sideMenuButton = document.querySelector('.sidemenu-button');
    const minimizeButton = document.querySelector('.minimize-button');
    const sidePanelHeader = document.querySelector('.side-panel-header');
    const sidePanelContent = document.querySelector('.side-panel-content');

    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Weather API fetch function
    async function fetchWeatherData() {
        try {
            const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.7143&longitude=-74.006&daily=sunrise,sunset,daylight_duration,uv_index_max&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,surface_pressure,visibility&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall&timezone=America%2FNew_York&past_days=2&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch');
            const data = await response.json();
            
            // Format and display current conditions
            const current = data.current;
            sidePanelContent.innerHTML = `
            <div class="weather-container">
                <div class="current-weather">
                    <h3>Current Conditions</h3>
                    <p>Temperature: ${current.temperature_2m}°F</p>
                    <p>Humidity: ${current.relative_humidity_2m}%</p>
                    <p>Rain: ${current.rain} inches</p>
                </div>
                
                <div class="daily-forecast">
                    <h3>Today's Details</h3>
                    <p>Sunrise: ${formatTime(data.daily.sunrise[2])}</p>
                    <p>Sunset: ${formatTime(data.daily.sunset[2])}</p>
                    <p>UV Index: ${data.daily.uv_index_max[2]}</p>
                    <p>Daylight: ${Math.round(data.daily.daylight_duration[2] / 3600)} hours</p>
                </div>
            </div>
        `;
        } catch (error) {
            sidePanelContent.innerHTML = '<p>Error loading weather data. Please try again later.</p>';
            console.error('Error:', error);
        }
    }

    function formatTime(timeString) {
        return new Date(timeString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    sideMenuButton.addEventListener('click', () => {
        sidePanel.classList.add('active');
        sideMenuButton.classList.add('hidden');
        fetchWeatherData(); // Fetch weather data when panel opens
    });
    
    setInterval(fetchWeatherData, 25000);  // 25000 milliseconds = 25 seconds


    minimizeButton.addEventListener('click', () => {
        sidePanel.classList.remove('active');
        sideMenuButton.classList.remove('hidden');
    });

    // Restore minimize button functionality
    minimizeButton.addEventListener('click', () => {
        sidePanel.classList.remove('active');
        sideMenuButton.classList.remove('hidden');
        // Reset position when minimizing
        xOffset = 0;
        yOffset = 0;
        sidePanel.style.transform = 'translate(0, -50%)';
    });

    // Restore menu button functionality
    sideMenuButton.addEventListener('click', () => {
        sidePanel.classList.add('active');
        sideMenuButton.classList.add('hidden');
        fetchWeatherData();
    });

    // Dragging functionality
    sidePanelHeader.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.closest('.minimize-button')) {
            return; // Don't start drag if clicking minimize button
        }
        
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target.closest('.side-panel-header')) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, sidePanel);
        }
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }
 

});
