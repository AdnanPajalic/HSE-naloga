(() => {
  const form = document.getElementById("query-form");
  const statusEl = document.getElementById("status");
  const chartEl = document.getElementById("chart");
  const tableEl = document.getElementById("summary-table");
  const dataTableEl = document.getElementById("data-table");
  const graphContainer = document.getElementById("graph-container");
  const dataTableContainer = document.getElementById("data-table-container");
  const viewToggle = document.getElementById("view-toggle");
  const graphViewBtn = document.getElementById("graph-view-btn");
  const tableViewBtn = document.getElementById("table-view-btn");
  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");
  const locationLabel = document.getElementById("location-label");
  const locationSelect = document.getElementById("location-select");
  const summaryPricesTemplate = document.getElementById("summary-prices-template");
  const summaryGenerationTemplate = document.getElementById("summary-generation-template");
  const summaryGenerationRowTemplate = document.getElementById("summary-generation-row-template");
  const noDataTemplate = document.getElementById("no-data-template");
  const dataTablePricesTemplate = document.getElementById("data-table-prices-template");
  const dataTablePricesRowTemplate = document.getElementById("data-table-prices-row-template");
  const dataTableGenerationTemplate = document.getElementById("data-table-generation-template");
  const dataTableGenerationRowTemplate = document.getElementById("data-table-generation-row-template");

  // load location data from the template into javascript object
  const locationData = JSON.parse(document.getElementById("location-data").textContent);
  
  let chart;
  let currentData = null;
  let currentDataType = null;

  // update status message on your page
  function setStatus(text, tone = "info") {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  function formatDateInput(date) {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function initializeDates() {
    const end = new Date();
    end.setDate(end.getDate() + 1)
    const start = new Date();
    start.setDate(end.getDate() - 7); // default to 7 days ago

    // set date input constraints
    const maxDate = formatDateInput(end);
    const minDate = new Date();
    minDate.setFullYear(end.getFullYear() - 10); // allow up to 10 years back

    form.start.value = formatDateInput(start);
    form.end.value = formatDateInput(end);
    form.start.max = maxDate;
    form.end.max = maxDate;
    form.start.min = formatDateInput(minDate);
    form.end.min = formatDateInput(minDate);
  }

  // when fetching new data we have to remove the old chart
  function destroyChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  // convert data into format that chart.js can plot
  // example: [{ x: Date(Dec 7, 00:00), y: 45.2 }]
  function toChartPoints(series) {
    const chartPoints = [];

    for (let i = 0; i < series.length; i++) {
      const point = series[i];

      const chartPoint = {
        x: new Date(point.timestamp),
        y: point.value
      };
      chartPoints.push(chartPoint);
    }
    console.log(chartPoints);
    return chartPoints;
  }

  // calculate date range in days from form
  function getDateRangeDays() {
    const startDate = new Date(form.start.value);
    const endDate = new Date(form.end.value);
    // convert milliseconds to days
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  }

  // determine time unit based on date range
  function getTimeUnit(days) {
    if (days < 7) return 'hour';
    if (days <= 60) return 'day';
    return 'month';
  }

  // aggregate data points by time period 
  function aggregateData(series, timeUnit) {
    // group data points by time period
    const grouped = {};
    
    for (const point of series) {
      const date = new Date(point.timestamp);
      const key = getGroupKey(date, timeUnit);
      
      // add key if it doesnt exist
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(point.value);
    }
    // avergae for groups
    const results = [];
    
    for (const [key, values] of Object.entries(grouped)) {
      const sum = values.reduce((total, val) => total + val, 0);
      const average = sum / values.length;
      results.push({
        timestamp: getTimestampFromKey(key, timeUnit),
        value: average
      });
    }
    // sort from oldest to newest
    results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return results;
  }

  // create a grouping key from time unit
  function getGroupKey(date, timeUnit) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    if (timeUnit === 'hour') {
      return `${year}-${month}-${day} ${hour}:00:00`;
    } else if (timeUnit === 'day') {
      return `${year}-${month}-${day}`;
    } else {
      return `${year}-${month}`;
    }
  }

  // convert a group key back to an ISO timestamp
  function getTimestampFromKey(key, timeUnit) {
    if (timeUnit === 'hour') {
      return new Date(key).toISOString();
    } else if (timeUnit === 'day') {
      return new Date(key + 'T12:00:00Z').toISOString(); // use 12PM
    } else {
      return new Date(key + '-15T12:00:00Z').toISOString();  // use 15th day, noon
    }
  }

  // time format for chart, how timestamps will be displayed on it
  function getTimeFormat(timeUnit) {
    switch (timeUnit) {
      case 'hour': return { unit: 'hour', tooltipFormat: 'MMM dd, HH:mm', displayFormats: { hour: 'MMM dd, HH:mm' } };
      case 'day': return { unit: 'day', tooltipFormat: 'PP', displayFormats: { day: 'MMM dd' } };
      case 'month': return { unit: 'month', tooltipFormat: 'MMM yyyy', displayFormats: { month: 'MMM yyyy' } };
      default: return{ tooltipFormat: 'PPpp' };
    }
  };

  // empty graph if no data is found
  function emptyChart() {
    chart = new Chart(chartEl, {
        type: "line",
        data: {
          datasets: []
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'No data available',
              color: '#cfe5ff',
              font: { size: 16 }
            }
          },
          scales: {
            x: {
              ticks: { color: "#cfe5ff" },
              grid: { color: "rgba(255,255,255,0.08)" },
            },
            y: {
              ticks: { color: "#cfe5ff" },
              grid: { color: "rgba(255,255,255,0.08)" },
            },
          }
        }
      });
      return chart;
  }

  function renderPrices(series) {
    destroyChart();
    // if there is no data display empty graph
    if (!series || series.length === 0) {
      chart = emptyChart();
      return;
    }
    const days = getDateRangeDays();
    const timeUnit = getTimeUnit(days);
    const aggregatedSeries = aggregateData(series, timeUnit);
    const timeFormat = getTimeFormat(timeUnit);
    
    let label = "Market price (EUR/MWh)";
    if (timeUnit === 'hour') label = "Hourly avergae price (EUR/MWh)";
    if (timeUnit === 'day') label = "Daily average price (EUR/MWh)";
    if (timeUnit === 'month') label = "Monthly average price (EUR/MWh)";
    
    chart = new Chart(chartEl, {
      type: "line",
      data: {
        datasets: [
          {
            label: label,
            data: toChartPoints(aggregatedSeries),
            borderColor: "#4cd3c2",
            backgroundColor: "rgba(76, 211, 194, 0.15)",
            fill: true,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: "time",
            time: timeFormat,
            ticks: { color: "#cfe5ff" },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
          y: {
            ticks: { color: "#cfe5ff" },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
        },
        plugins: {
          legend: { labels: { color: "#e8f1ff" } },
          tooltip: {
            callbacks: {
              label: function(context) {return `${context.parsed.y.toFixed(2)} EUR/MWh`}, // when hovering point on graph
            },
          },
        },
      },
    });
  };

  const colorPalette = [
  "#4cd3c2",
  "#f2b880",
  "#8ac7ff",
  "#ff7f87",
  "#c1b4ff",
  "#7bdc92",
  "#f6d14b",
  "#5fd1a7",
  "#ff9f68",
  "#6fa8dc",
  "#e57373",
  "#9575cd",
  "#4db6ac",
  "#ffd54f",
  "#81c784",
  "#ffb74d",
  "#64b5f6",
  "#ba68c8",
  "#4fc3f7",
  "#a1887f",
  "#90a4ae",
  "#f48fb1",
  "#ce93d8",
  "#80cbc4",
  "#ffcc80",
];

  const renderGeneration = (seriesMap) => {
    destroyChart()
    // if there is no data display empty graph
    if (!seriesMap || Object.keys(seriesMap).length === 0) {
      chart = emptyChart();
      return;
    }
    const days = getDateRangeDays();
    const timeUnit = getTimeUnit(days);
    const timeFormat = getTimeFormat(timeUnit);

    const datasets = Object.entries(seriesMap).map(([label, data], index) => {
      const aggregatedData = aggregateData(data, timeUnit);
      return {
        label,
        data: toChartPoints(aggregatedData),
        borderColor: colorPalette[index],
        backgroundColor: colorPalette[index] + "33",
        fill: false,
        tension: 0.15,
      };
    });

    // y axis title based on time unit
    let yAxisTitle = "MW";
    if (timeUnit === 'hour') yAxisTitle = "Hourly average (MW)";
    if (timeUnit === 'day') yAxisTitle = "Daily average (MW)";
    if (timeUnit === 'month') yAxisTitle = "Monthly avgerage (MW)";

    chart = new Chart(chartEl, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        interaction: { mode: "nearest", intersect: false },
        scales: {
          x: {
            type: "time",
            time: timeFormat,
            ticks: { color: "#cfe5ff" },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
          y: {
            ticks: { color: "#cfe5ff" },
            grid: { color: "rgba(255,255,255,0.08)" },
            title: { display: true, text: yAxisTitle, color: "#cfe5ff" },
          },
        },
        plugins: {
          legend: { labels: { color: "#e8f1ff" } },
          tooltip: {
            callbacks: {
              label: function(context) {return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} MW`},
            },
          },
        },
      },
    });
  };

  function summarize(values) {
    if (!values.length) return { min: 0, max: 0, mean: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((accumulator, value) => accumulator + value, 0) / values.length;
    return {min, max, mean};
  };

  function renderSummaryTable(dataType, payload) {
    const days = getDateRangeDays();
    const timeUnit = getTimeUnit(days);

    if (dataType === "prices") {
      // if empty data
      if (!payload.series || payload.series.length === 0) {
        const noData = noDataTemplate.content.cloneNode(true);
        tableEl.appendChild(noData);
        return;
      }
    
      const aggregatedSeries = aggregateData(payload.series, timeUnit);
      const values = aggregatedSeries.map((p) => p.value);
      const stats = summarize(values);
      
      // send values to the user and display it
      const template = summaryPricesTemplate.content.cloneNode(true);
      template.querySelector('[data-field="min"]').textContent = `${stats.min.toFixed(2)}`;
      template.querySelector('[data-field="mean"]').textContent = `${stats.mean.toFixed(2)}`;
      template.querySelector('[data-field="max"]').textContent = `${stats.max.toFixed(2)}`;
      tableEl.appendChild(template);
      return;
    }

    // empty generation data
    if (!payload.series || Object.keys(payload.series).length === 0) {
      const noData = noDataTemplate.content.cloneNode(true);
      noData.querySelector('[data-field="col1"]').textContent = "Source";
      noData.querySelector('[data-field="col2"]').textContent = "Values";
      noData.querySelector('td[colspan]').setAttribute('colspan', '3');
      tableEl.appendChild(noData);
      return;
    }

    const headerText = timeUnit === 'hour' ? 'Hourly average values|Hourly Peak' :
                      timeUnit === 'day' ? 'Daily average values|Daily Peak' : 
                      'Monthly Avg.|Monthly Peak';
    const [avgHeader, peakHeader] = headerText.split('|');

    const template = summaryGenerationTemplate.content.cloneNode(true);
    template.querySelector('[data-field="avg-header"]').textContent = avgHeader;
    template.querySelector('[data-field="peak-header"]').textContent = peakHeader;
    const tbody = template.querySelector('tbody');

    Object.entries(payload.series).forEach(([label, points]) => {
      const aggregatedPoints = aggregateData(points, timeUnit);
      const values = aggregatedPoints.map((p) => p.value);
      const stats = summarize(values);
      
      const row = summaryGenerationRowTemplate.content.cloneNode(true);
      row.querySelector('[data-field="label"]').textContent = label;
      row.querySelector('[data-field="avg"]').textContent = `${stats.mean.toFixed(1)}`;
      row.querySelector('[data-field="peak"]').textContent = `${stats.max.toFixed(1)}`;
      tbody.appendChild(row);
    });
    tableEl.appendChild(template);
  };

  // toggle between graph and table views
  graphViewBtn.addEventListener("click", () => {
    graphContainer.style.display = "block";
    dataTableContainer.style.display = "none";
    graphViewBtn.classList.add("active");
    tableViewBtn.classList.remove("active");
  });

  // helper to format time display
  const formatTimeDisplay = (date, timeUnit) => {
    if (timeUnit === 'hour') {
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (timeUnit === 'day') {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'long' 
      });
    }
  };

  // render data table and display logic
  const renderDataTable = (dataType, payload) => {
    const days = getDateRangeDays();
    const timeUnit = getTimeUnit(days);
    const timeLabel = timeUnit === 'hour' ? 'Hour' : timeUnit === 'day' ? 'Date' : 'Month';

    if (dataType === "prices") {
      // handle empty data
      if (!payload.series || payload.series.length === 0) {
        const noData = noDataTemplate.content.cloneNode(true);
        noData.querySelector('[data-field="col1"]').textContent = timeLabel;
        noData.querySelector('[data-field="col2"]').textContent = "Price (EUR/MWh)";
        noData.querySelector('td[colspan]').style.padding = "20px";
        dataTableEl.appendChild(noData);
        return;
      }
      
      const aggregatedSeries = aggregateData(payload.series, timeUnit);
      const template = dataTablePricesTemplate.content.cloneNode(true);
      template.querySelector('[data-field="time-header"]').textContent = timeLabel;
      const tableBody = template.querySelector('tbody');

      aggregatedSeries.forEach(point => {
        const row = dataTablePricesRowTemplate.content.cloneNode(true);
        row.querySelector('[data-field="time"]').textContent = formatTimeDisplay(new Date(point.timestamp), timeUnit);
        row.querySelector('[data-field="price"]').textContent = point.value.toFixed(2);
        tableBody.appendChild(row);
      });
      dataTableEl.appendChild(template);
    } else {
      // generation data table
      // first empty data handle
      if (!payload.series || Object.keys(payload.series).length === 0) {
        const noData = noDataTemplate.content.cloneNode(true);
        noData.querySelector('[data-field="col1"]').textContent = timeLabel;
        noData.querySelector('[data-field="col2"]').textContent = "Generation (MW)";
        noData.querySelector('td[colspan]').style.padding = "20px";
        dataTableEl.appendChild(noData);
        return;
      }
      
      const aggregatedSeriesMap = {};
      Object.entries(payload.series).forEach(([label, data]) => {
        aggregatedSeriesMap[label] = aggregateData(data, timeUnit);
      });

      // get all unique timestamps
      const allTimestamps = new Set();
      Object.values(aggregatedSeriesMap).forEach(series => {
        series.forEach(point => allTimestamps.add(point.timestamp));
      });

      // sort dates to display them in table
      const sortedTimestamps = Array.from(allTimestamps).sort();

      const template = dataTableGenerationTemplate.content.cloneNode(true);
      const headerRow = template.querySelector('thead tr');
      const tableBody = template.querySelector('tbody');

      // build header row
      const timeHeader = document.createElement('th');
      timeHeader.textContent = timeLabel;
      headerRow.appendChild(timeHeader);
      
      // add generation types as column names for table
      Object.keys(aggregatedSeriesMap).forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        headerRow.appendChild(th);
      });

      // build data rows
      sortedTimestamps.forEach(timestamp => {
        const row = dataTableGenerationRowTemplate.content.cloneNode(true);
        const tr = row.querySelector('tr');
        
        const timeCell = document.createElement('td');
        timeCell.textContent = formatTimeDisplay(new Date(timestamp), timeUnit);
        tr.appendChild(timeCell);

        Object.values(aggregatedSeriesMap).forEach(series => {
          const point = series.find(p => p.timestamp === timestamp);
          const td = document.createElement('td');
          td.textContent = point ? point.value.toFixed(1) : '-';
          tr.appendChild(td);
        });
        tableBody.appendChild(row);
      });
      dataTableEl.appendChild(template);
    }
  };

    tableViewBtn.addEventListener("click", () => {
    graphContainer.style.display = "none";
    dataTableContainer.style.display = "block";
    graphViewBtn.classList.remove("active");
    tableViewBtn.classList.add("active");
  });

  // handle data type selection: step 1
  const dataTypeInputs = form.querySelectorAll('input[name="type"]');
  dataTypeInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const dataType = e.target.value;
      step2.style.display = "block";

      // auto-select location type based on data type
      const locationTypeInputs = form.querySelectorAll('input[name="location-type"]');
      if (dataType === "prices") {
        // auto-select bidding zones
        locationTypeInputs.forEach((input) => {
          if (input.value === "bidding-zones") {
            input.checked = true;
            input.dispatchEvent(new Event("change"));
          }
        });
        // sisable other options for prices
        locationTypeInputs.forEach((input) => {
          if (input.value !== "bidding-zones") {
            input.disabled = true;
            input.parentElement.style.opacity = "0.5";
            input.parentElement.style.pointerEvents = "none";
          } else {
            input.disabled = false;
            input.parentElement.style.opacity = "1";
            input.parentElement.style.pointerEvents = "auto";
          }
        });
      } else {
        // enable all options for generation
        locationTypeInputs.forEach((input) => {
          input.disabled = false;
          input.parentElement.style.opacity = "1";
          input.parentElement.style.pointerEvents = "auto";
        });
      }
    });
  });

  // handle location type selection: step 2
  const locationTypeInputs = form.querySelectorAll('input[name="location-type"]');
  locationTypeInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const locationType = e.target.value;
      step3.style.display = "block";
      
      // add highlight to date inputs when they become available
      setTimeout(() => {
        const dateInputs = form.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
          input.style.animation = "dateHighlight 2s ease-in-out";
        });
      }, 300);

      // update label and populate select options based on location type
      let locations = [];
      if (locationType === "bidding-zones") {
        locationLabel.textContent = "Bidding zone";
        locations = locationData["bidding-zones"];
      } else if (locationType === "countries") {
        locationLabel.textContent = "Country";
        locations = locationData["countries"];
      } else if (locationType === "control-areas") {
        locationLabel.textContent = "Control area";
        locations = locationData["control-areas"];
      }

      // clear and populate the select dropdown
      locationSelect.innerHTML = "";
      locations.forEach((location) => {
        const option = document.createElement("option");
        option.value = location;
        option.textContent = location;
        locationSelect.appendChild(option);
      });
    });
  });

  // add date validation
  const validateDates = () => {
    const startDate = new Date(form.start.value);
    const endDate = new Date(form.end.value);
    
    if (endDate <= startDate) {
      setStatus("End date must be after start date.", "error");
      return false;
    }
    
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      setStatus("Date range cannot exceed 365 days (1 year).", "error");
      return false;
    }
    
    return true;
  };

  // add event listeners for date inputs
  form.start.addEventListener("change", () => {
    form.end.min = form.start.value;
    validateDates();
  });
  
  form.end.addEventListener("change", () => {
    form.start.max = form.end.value;
    validateDates();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    if (!validateDates()) {
      return;
    }
    
    const formData = new FormData(form);
    const params = new URLSearchParams(formData);

    setStatus("Fetching data from ENTSO-E API...", "info");
    tableEl.innerHTML = "";
    dataTableEl.innerHTML = "";
    destroyChart();
    viewToggle.style.display = "none";

    try {
      const type = formData.get("type");
      if (type === "prices") {
        params.delete("type");
        params.delete("location-type")
        const response = await fetch(`/price?${params.toString()}`);
        const json = await response.json();
        const days = getDateRangeDays();
        const timeUnit = getTimeUnit(days);
        const timeFrameText = timeUnit === 'hour' ? 'hourly' : timeUnit === 'day' ? 'daily' : 'monthly';

        if (json.warning) {
          setStatus(json.warning, "error");
        } else {
          setStatus(`Showing ${timeFrameText} ${formData.get("type")} for ${json.zone}.`, "success");
        }
        currentData = json.data;
        currentDataType = type;
        viewToggle.style.display = "flex";
        renderPrices(json.data.series)
        renderSummaryTable(type, json.data); // 
        if (currentData && currentDataType) {
          renderDataTable(currentDataType, currentData);
        }
      }

      else if (type === "generation") {
        params.delete("type");
        const response = await fetch(`/generation?${params.toString()}`);
        const json = await response.json();
        const days = getDateRangeDays();
        const timeUnit = getTimeUnit(days);
        const timeFrameText = timeUnit === 'hour' ? 'hourly' : timeUnit === 'day' ? 'daily' : 'monthly';
        
        if (json.warning) {
          setStatus(json.warning, "error");
        } else {
          setStatus(`Showing ${timeFrameText} ${formData.get("type")} for ${json.zone}.`, "success");
        }
        currentData = json.data;
        currentDataType = type;
        viewToggle.style.display = "flex";
        renderGeneration(json.data.series)
        renderSummaryTable(type, json.data);
        if (currentData && currentDataType) {
          renderDataTable(currentDataType, currentData);
        }
      }
    } 
    catch (error) {
      console.error(error);
      setStatus("Network error while fetching data.", "error");
      // keep graph view visible but empty
      graphContainer.style.display = "block";
      dataTableContainer.style.display = "none";
    }
  });

  initializeDates();
})();