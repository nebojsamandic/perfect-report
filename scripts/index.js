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

