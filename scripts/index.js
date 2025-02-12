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
