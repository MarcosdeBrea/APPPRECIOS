/********************* Selector Global *********************/
document.querySelectorAll('input[name="modeSelector"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    const value = e.target.value;
    // Hide all app containers first
    document.getElementById("jdeApp").style.display = "none";
    document.getElementById("webApp").style.display = "none";
    document.getElementById("maderaApp").style.display = "none";
    document.getElementById("fabricaApp").style.display = "none"; // Ocultar nueva app

    // Show the selected app container
    if (value === "JDE") {
      document.getElementById("jdeApp").style.display = "block";
    } else if (value === "WEB") {
      document.getElementById("webApp").style.display = "block";
    } else if (value === "MADERA") {
      document.getElementById("maderaApp").style.display = "block";
    } else if (value === "FABRICA") { // Mostrar nueva app
      document.getElementById("fabricaApp").style.display = "block";
    }
  });
});

/********************* Aplicación JDE (IIFE) *********************/
(function(){
  // State for JDE App
  let columns = {
    precioBase: true,
    pedido350: true,
    pedidoPaquete34: true,
    pedidoPaquete36: true,
    unidadesPaquete: true,
    stockSantiago: true,
    stockCentral: true,
    medidas: true
  };
  const columnLabelsDefault = {
    precioBase: "Precio Base",
    unidadesPaquete: "Unidades Paquete",
    stockSantiago: "Stock Santiago",
    stockCentral: "Stock Central",
    medidas: "Medidas"
  };

  // Function to get dynamic column labels based on discount config
  function getColumnLabel(key, currentDiscountConfig) {
    if(key === "pedido350") {
      return "Pedido Picking";
    }
    if(key === "pedidoPaquete34") {
      return "Pedido Paquete";
    }
    if(key === "pedidoPaquete36") {
      if(currentDiscountConfig === "B0") return "Pedido Paquete 35%";
      return "Pedido Paquete 38%"; // Default for A3, M3
    }
    return columnLabelsDefault[key] || key; // Fallback to default or key itself
  }

  let discountConfig = "A3"; // Initial discount config ("B0", "A3" o "M3")
  let tablesData = []; // Array to hold data for multiple tables

  // DOM Elements for JDE App
  const jdeInputDataElem    = document.getElementById("jdeInputData");
  const jdeBtnAddTable      = document.getElementById("jdeBtnAddTable");
  const jdeBtnClearText     = document.getElementById("jdeBtnClearText");
  const jdeBtnPrint         = document.getElementById("jdeBtnPrint");
  const jdeColumnsContainer = document.getElementById("jdeColumnsContainer");
  const jdeTablesContainer  = document.getElementById("jdeTablesContainer");
  const jdeChkUnidad        = document.getElementById("jdeChkUnidad");

  // --- Early Exit if Elements Don't Exist ---
  // This prevents errors if the script runs but the corresponding HTML isn't visible/present
  if (!jdeInputDataElem || !jdeBtnAddTable || !jdeBtnClearText || !jdeBtnPrint || !jdeColumnsContainer || !jdeTablesContainer || !jdeChkUnidad) {
      // console.log("JDE elements not found, skipping JDE app initialization.");
      return; // Exit this IIFE
  }
  // --- End Early Exit ---


  // Event Listeners for JDE App
  document.querySelectorAll('#jdeApp input[name="discountConfig"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      discountConfig = e.target.value;
      renderColumnsCheckboxes(); // Re-render checkboxes with updated labels
      renderTables(); // Re-render tables with new discounts
    });
  });

  jdeBtnAddTable.addEventListener("click", () => {
    const newRows = parseData();
    if(newRows.length > 0) {
      tablesData.push(newRows); // Add new set of rows as a new table
      renderTables(); // Render all tables including the new one
      jdeInputDataElem.value = ""; // Clear input after adding
    } else {
      // Use a more subtle notification or log instead of alert
      console.warn("No se pudieron procesar los datos JDE. Verifica el formato.");
      // alert("No se pudieron procesar los datos. Verifica el formato."); // Inform user if parsing failed
    }
  });

  jdeBtnClearText.addEventListener("click", () => {
    jdeInputDataElem.value = ""; // Clear the textarea
  });

  jdeBtnPrint.addEventListener("click", () => {
    window.print(); // Trigger browser's print dialog
  });

  // Check if jdeChkUnidad exists before adding listener
  if (jdeChkUnidad) {
      jdeChkUnidad.addEventListener("change", () => {
          renderTables(); // Re-render tables based on unit selection (m² or Tablero)
      });
  }


  // Initial rendering of column checkboxes
  renderColumnsCheckboxes();

  // Function to render checkboxes for column visibility
  function renderColumnsCheckboxes() {
    // Check if container exists
    if (!jdeColumnsContainer) return;
    jdeColumnsContainer.innerHTML = ""; // Clear existing checkboxes
    for(let colKey in columns) {
      const label = document.createElement("label");
      // Get the label text using the current discountConfig
      label.textContent = getColumnLabel(colKey, discountConfig);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = columns[colKey]; // Set checked state from state object
      checkbox.dataset.colKey = colKey; // Store key for the event listener

      checkbox.addEventListener("change", (e) => {
        const key = e.target.dataset.colKey;
        columns[key] = e.target.checked; // Update state
        renderTables(); // Re-render tables with updated column visibility
      });

      label.prepend(checkbox); // Add checkbox inside the label
      jdeColumnsContainer.appendChild(label);
    }
  }

  // Function to parse input data (currently only JDE format)
  function parseData() {
    // Check if element exists
    if (!jdeInputDataElem) return [];
    const input = jdeInputDataElem.value || "";
    if(!input.trim()) return []; // Return empty if input is empty
    // Potentially add logic here to detect format (JDE vs WEB) if needed
    return parseDataJDE(input);
  }

  // Function to parse JDE specific data format
  function parseDataJDE(input) {
    let rows = [];
    const lines = input.split("\n");
    const cantoRows = []; // Separate array for "canto" items
    const mainRows = [];  // Array for other items

    lines.forEach(line => {
      const trimmed = line.trim();
      if(!trimmed) return; // Skip empty lines

      const parts = trimmed.split("\t"); // Split by tab
      // Expecting at least 15 columns based on original logic
      if(parts.length < 15) {
          console.warn("Skipping JDE line due to insufficient columns:", line);
          return;
      };

      // Extract data, trim whitespace, and parse numbers
      const descripcion = parts[3].trim();
      const medidas = parts[4].trim();
      const largo = parseNumber(parts[5]);
      const ancho = parseNumber(parts[6]);
      const alto = parseNumber(parts[7]); // Used for sorting
      const pvpNum = parseNumber(parts[8]); // Base price (per m² usually)
      const stockSantiagoNum = parseNumber(parts[9]);
      const stockCentralNum = parseNumber(parts[10]);
      // Unidades Paquete: Use value if not "1", otherwise empty string
      const unidadesPaqueteVal = (parts[14].trim() === "1") ? "" : parts[14].trim();

      let stockSantiago = "";
      let stockCentral = "";

      // Calculate stock in units (Tableros) if dimensions are available
      if (stockSantiagoNum > 0 || stockCentralNum > 0) {
        if(largo !== 1000) { // Check if it's not a "canto" type item (often largo=1000)
          const area = calculateArea(largo, ancho);
          if(area > 0) {
            // Calculate stock in pieces (Tableros) by dividing total m² by area per piece
            const stSantiagoCalc = Math.floor(stockSantiagoNum / area);
            const stCentralCalc = Math.floor(stockCentralNum / area);
            if(stSantiagoCalc > 0) stockSantiago = stSantiagoCalc.toString();
            if(stCentralCalc > 0) stockCentral = stCentralCalc.toString();
          }
        } else {
          // For items like "canto" where calculation might not apply, use the raw number if > 0
          stockSantiago = stockSantiagoNum > 0 ? stockSantiagoNum.toString() : "";
          stockCentral = stockCentralNum > 0 ? stockCentralNum.toString() : "";
        }
      }

      // Create row object
      const row = {
        descripcion,
        medidas,
        alto, // Keep for sorting
        pvpNum, // Original price value (likely per m²)
        largo, // Keep for area calculation
        ancho, // Keep for area calculation
        stockSantiago, // Calculated or direct stock string
        stockCentral, // Calculated or direct stock string
        unidadesPaquete: unidadesPaqueteVal
      };

      // Separate "canto" items
      if(descripcion.toLowerCase().startsWith("canto")) {
        cantoRows.push(row);
      } else {
        mainRows.push(row);
      }
    });

    // Sort main rows by 'alto' (thickness/height)
    mainRows.sort((a, b) => a.alto - b.alto);

    // Combine sorted main rows and canto rows
    rows = [...mainRows, ...cantoRows];
    return rows;
  }

  // Function to calculate discounts based on base price and config
  function calculateDiscounts(precioBase, currentDiscountConfig) {
    let pedidoPicking, pedidoPaquete, pedidoPaqueteFinal;
    const formatCurrency = (value) => `${value.toFixed(2)} €`; // Helper to format

    switch(currentDiscountConfig) {
      case "B0":
        pedidoPicking = formatCurrency(precioBase * (1 - 0.28));
        pedidoPaquete = formatCurrency(precioBase * (1 - 0.33));
        pedidoPaqueteFinal = formatCurrency(precioBase * (1 - 0.35)); // 35% for B0
        break;
      case "M3":
        pedidoPicking = formatCurrency(precioBase * (1 - 0.33));
        pedidoPaquete = formatCurrency(precioBase * (1 - 0.37));
        pedidoPaqueteFinal = formatCurrency(precioBase * (1 - 0.38)); // 38% for M3
        break;
      default: // A3 (and fallback)
        pedidoPicking = formatCurrency(precioBase * (1 - 0.31));
        pedidoPaquete = formatCurrency(precioBase * (1 - 0.36));
        pedidoPaqueteFinal = formatCurrency(precioBase * (1 - 0.38)); // 38% for A3
        break;
    }
    return {
      pedido350: pedidoPicking,       // Corresponds to 'Pedido Picking' column
      pedidoPaquete34: pedidoPaquete,   // Corresponds to 'Pedido Paquete' column
      pedidoPaquete36: pedidoPaqueteFinal // Corresponds to 'Pedido Paquete 35%/38%' column
    };
  }

  // Function to render all tables based on tablesData array
  function renderTables() {
    // Check if elements exist
    if (!jdeTablesContainer || !jdeChkUnidad) return;
    // Determine unit text based on checkbox
    let unidadTexto = jdeChkUnidad.checked ? "por M²" : "por Tablero";
    jdeTablesContainer.innerHTML = `<h2>Tablas de Precios Netos ${unidadTexto}</h2>`; // Set main title

    tablesData.forEach((rows, index) => {
      const tableWrapper = document.createElement("div");
      tableWrapper.style.marginBottom = "2rem"; // Spacing between tables
      tableWrapper.classList.add("table-wrapper"); // Add class for potential styling

      // Add remove button for this specific table
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Eliminar Tabla"; // More descriptive text
      removeBtn.className = "close-btn no-print"; // Use existing class + no-print
      removeBtn.style.marginBottom = "0.5rem";
      removeBtn.style.display = "block"; // Make it block for positioning
      removeBtn.style.marginLeft = "auto"; // Push to the right
      removeBtn.style.backgroundColor = "#fdd"; // Give it a distinct look
      removeBtn.style.color = "#a00";
      removeBtn.style.border = "1px solid #a00";
      removeBtn.style.padding = "0.2rem 0.5rem";


      removeBtn.addEventListener("click", () => {
        tablesData.splice(index, 1); // Remove this table's data from the array
        renderTables(); // Re-render the remaining tables
      });

      const table = document.createElement("table");
      table.innerHTML = generateTableHTML(rows); // Generate HTML for this table

      tableWrapper.appendChild(removeBtn); // Add remove button first
      tableWrapper.appendChild(table);     // Then add the table
      jdeTablesContainer.appendChild(tableWrapper); // Add wrapper to the container
    });
  }

  // Function to generate HTML string for a single table
  function generateTableHTML(rows) {
    let theadHTML = "<thead><tr>";
    theadHTML += "<th>Descripción</th>"; // Always show description

    // Dynamically add header columns based on visibility state
    if(columns.medidas) {
      theadHTML += `<th>${getColumnLabel("medidas", discountConfig)}</th>`;
    }
    if(columns.precioBase) {
      theadHTML += `<th>${getColumnLabel("precioBase", discountConfig)}</th>`;
    }
    if(columns.pedido350) {
      theadHTML += `<th>${getColumnLabel("pedido350", discountConfig)}</th>`;
    }
    if(columns.pedidoPaquete34) {
      theadHTML += `<th>${getColumnLabel("pedidoPaquete34", discountConfig)}</th>`;
    }
    if(columns.pedidoPaquete36) {
      theadHTML += `<th>${getColumnLabel("pedidoPaquete36", discountConfig)}</th>`;
    }
    if(columns.unidadesPaquete) {
      theadHTML += `<th>${getColumnLabel("unidadesPaquete", discountConfig)}</th>`;
    }
    if(columns.stockSantiago) {
      theadHTML += `<th>${getColumnLabel("stockSantiago", discountConfig)}</th>`;
    }
    if(columns.stockCentral) {
      theadHTML += `<th>${getColumnLabel("stockCentral", discountConfig)}</th>`;
    }
    theadHTML += "</tr></thead>";

    let tbodyHTML = "<tbody>";
    rows.forEach(row => {
      let basePriceForCalc; // Price used for discount calculation
      // Determine base price based on unit selection (m² or Tablero)
      if(jdeChkUnidad && jdeChkUnidad.checked) { // Check existence
        // Use the direct price (assumed to be per m²)
        basePriceForCalc = row.pvpNum;
      } else {
        // Calculate price per Tablero
        if(row.largo !== 1000) { // Avoid calculation for "canto" if needed
          const area = calculateArea(row.largo, row.ancho);
          // Ensure area is positive to avoid division by zero or negative prices
          basePriceForCalc = area > 0 ? parseFloat((area * row.pvpNum).toFixed(2)) : 0;
        } else {
          // For items like "canto", use the pvpNum directly if it represents price per unit
          basePriceForCalc = row.pvpNum;
        }
      }

      // Calculate discounts using the determined base price and current config
      const discounts = calculateDiscounts(basePriceForCalc, discountConfig);

      tbodyHTML += "<tr>";
      tbodyHTML += `<td>${row.descripcion}</td>`; // Description cell

      // Dynamically add data cells based on visibility state
      if(columns.medidas) {
        tbodyHTML += `<td>${row.medidas}</td>`;
      }
      if(columns.precioBase) {
        // Display the calculated base price (either per m² or per Tablero)
        tbodyHTML += `<td>${basePriceForCalc.toFixed(2)} €</td>`;
      }
      if(columns.pedido350) {
        tbodyHTML += `<td>${discounts.pedido350}</td>`;
      }
      if(columns.pedidoPaquete34) {
        tbodyHTML += `<td>${discounts.pedidoPaquete34}</td>`;
      }
      if(columns.pedidoPaquete36) {
        tbodyHTML += `<td>${discounts.pedidoPaquete36}</td>`;
      }
      if(columns.unidadesPaquete) {
        tbodyHTML += `<td>${row.unidadesPaquete}</td>`;
      }
      if(columns.stockSantiago) {
        tbodyHTML += `<td>${row.stockSantiago}</td>`;
      }
      if(columns.stockCentral) {
        tbodyHTML += `<td>${row.stockCentral}</td>`;
      }
      tbodyHTML += "</tr>";
    });
    tbodyHTML += "</tbody>";

    return theadHTML + tbodyHTML; // Return complete table HTML
  }

  // Helper function to parse numbers (handles Spanish format with '.' thousand sep and ',' decimal)
  function parseNumber(value) {
    if(!value || typeof value !== 'string') return 0;
    // Remove thousand separators (.), replace decimal comma (,) with dot (.)
    return parseFloat(value.replace(/\./g, "").replace(/,/g, ".")) || 0;
  }

  // Helper function to calculate area in square meters from mm dimensions
  function calculateArea(largo, ancho) {
      if (typeof largo !== 'number' || typeof ancho !== 'number' || largo <= 0 || ancho <= 0) {
          return 0; // Return 0 if dimensions are invalid
      }
      return (largo / 1000) * (ancho / 1000); // Convert mm to meters and multiply
  }

})(); // End of JDE App IIFE

/********************* Aplicación Web (IIFE) *********************/
(function(){
  // State for Web App
  let columns = {
    codigo: true,
    medidas: true,
    precioBase: true,
    pedidoPicking: true,
    pedidoPaquete: true,
    isOutlet: true
  };
  const columnLabelsDefault = {
    codigo: "Código",
    medidas: "Medidas",
    precioBase: "Precio Base",
    pedidoPicking: "Precio Picking", // Label updated
    pedidoPaquete: "Precio Paquete", // Label updated
    isOutlet: "Outlet"
  };

  // Function to get column labels (can be extended if needed)
  function getColumnLabel(key) {
    // No dynamic labels needed for Web app currently, unlike JDE
    return columnLabelsDefault[key] || key;
  }

  let discountConfig = "A"; // Initial discount config ("A", "B" o "M")
  let tablesData = []; // Array to hold data for multiple tables

  // DOM Elements for Web App
  const webInputDataElem    = document.getElementById("webInputData");
  const webBtnAddTable      = document.getElementById("webBtnAddTable");
  const webBtnClearText     = document.getElementById("webBtnClearText");
  const webBtnPrint         = document.getElementById("webBtnPrint");
  const webColumnsContainer = document.getElementById("webColumnsContainer");
  const webTablesContainer  = document.getElementById("webTablesContainer");
  const webChkUnidad        = document.getElementById("webChkUnidad");
  const webChkPaquete38     = document.getElementById("webChkPaquete38"); // Checkbox for 38% package discount

  // --- Early Exit if Elements Don't Exist ---
  if (!webInputDataElem || !webBtnAddTable || !webBtnClearText || !webBtnPrint || !webColumnsContainer || !webTablesContainer || !webChkUnidad || !webChkPaquete38) {
      // console.log("Web elements not found, skipping Web app initialization.");
      return; // Exit this IIFE
  }
  // --- End Early Exit ---

  // Event Listeners for Web App
  document.querySelectorAll('#webApp input[name="discountConfigWeb"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      discountConfig = e.target.value;
      // No need to re-render checkboxes as labels are static
      renderTables(); // Re-render tables with new discounts
    });
  });

  webChkUnidad.addEventListener("change", () => {
    renderTables(); // Re-render tables based on unit selection
  });

  webChkPaquete38.addEventListener("change", () => {
    renderTables(); // Re-render tables when 38% package option changes
  });

  webBtnAddTable.addEventListener("click", () => {
    const newRows = parseData();
    if(newRows.length > 0) {
      tablesData.push(newRows); // Add new set of rows
      renderTables(); // Render all tables
      webInputDataElem.value = ""; // Clear input
    } else {
      // alert("No se pudieron procesar los datos. Verifica el formato.");
      console.warn("No se pudieron procesar los datos Web. Verifica el formato.");
    }
  });

  webBtnClearText.addEventListener("click", () => {
    webInputDataElem.value = ""; // Clear the textarea
  });

  webBtnPrint.addEventListener("click", () => {
    // Potentially hide non-web elements before printing if needed
    // e.g., document.getElementById('jdeApp').style.display = 'none';
    window.print();
    // Restore display if hidden
    // e.g., document.getElementById('jdeApp').style.display = 'block'; // Or based on original state
  });

  // Initial rendering of column checkboxes
  renderColumnsCheckboxes();

  // Function to render checkboxes for column visibility
  function renderColumnsCheckboxes() {
    if (!webColumnsContainer) return;
    webColumnsContainer.innerHTML = ""; // Clear existing checkboxes
    for(let colKey in columns) {
      const label = document.createElement("label");
      label.textContent = getColumnLabel(colKey); // Get static label
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = columns[colKey];
      checkbox.dataset.colKey = colKey; // Store key

      checkbox.addEventListener("change", (e) => {
        const key = e.target.dataset.colKey;
        columns[key] = e.target.checked; // Update state
        renderTables(); // Re-render tables
      });

      label.prepend(checkbox);
      webColumnsContainer.appendChild(label);
    }
  }

  // Function to parse input data for Web format
  function parseData() {
    if (!webInputDataElem) return [];
    const input = webInputDataElem.value.trim();
    if (!input) return []; // Return empty if input is empty

    const lines = input.split("\n").map(line => line.trim()).filter(line => line !== ""); // Split, trim, filter empty
    let rows = [];

    lines.forEach(line => {
      const fields = line.split("\t"); // Split by tab
      // Basic check for expected number of fields (adjust if needed)
      if (fields.length < 9) {
          console.warn("Skipping Web line due to insufficient columns:", line);
          return;
      }

      let codigo = fields[0] || "";
      let descripcionOriginal = fields[1] || "";
      // Attempt to remove trailing dimensions from description (e.g., " 2800 1220 19")
      let descripcion = descripcionOriginal.replace(/\s+\d+\s+\d+\s+\d+(?:[.,]\d+)?\s*$/, "").trim();
      if (!descripcion) descripcion = descripcionOriginal; // Fallback if regex removed everything

      let largo = parseNumber(fields[2]);
      let ancho = parseNumber(fields[3]);
      let grosor = parseNumber(fields[4]);
      // Format thickness: use comma for decimal, no decimal if integer
      let formattedGrosor = (grosor % 1 === 0) ? grosor.toString() : grosor.toFixed(2).replace(".", ",");

      // Check for "outlet" in the relevant field (e.g., field index 5)
      let isOutlet = fields[5] && fields[5].toLowerCase().includes("outlet");

      // Extract price, handling potential currency symbols or extra text
      const precioStr = fields[8] || "0";
      let priceM2 = 0;
      // Regex to find the first number (integer or decimal with . or ,)
      let precioMatch = precioStr.match(/([\d.,]+)/);
      if (precioMatch) {
          priceM2 = parseNumber(precioMatch[1]); // Use parseNumber to handle format
      }


      let medidas = `${largo}x${ancho}x${formattedGrosor}`; // Construct dimensions string

      // Create row object
      let row = {
        codigo,
        descripcion,
        largo, // Keep for area calculation
        ancho, // Keep for area calculation
        grosor, // Keep for sorting
        priceM2, // Price per m²
        medidas, // Formatted dimensions string
        isOutlet: isOutlet ? "Sí" : "No" // Store as "Sí" or "No"
      };
      rows.push(row);
    });

    // Sort rows by 'grosor' (thickness)
    rows.sort((a, b) => a.grosor - b.grosor);
    return rows;
  }

  // Function to calculate discounts for Web app
  function calculateDiscounts(precioBase, currentDiscountConfig, usePaquete38) {
    let precioPicking, precioPaquete;
    const formatCurrency = (value) => `${value.toFixed(2)} €`;

    if(currentDiscountConfig === "B") { // Cliente B
      precioPicking = formatCurrency(precioBase * (1 - 0.28));
      precioPaquete = formatCurrency(precioBase * (1 - 0.33)); // Standard package for B
    } else if(currentDiscountConfig === "M") { // Cliente M
      precioPicking = formatCurrency(precioBase * (1 - 0.34)); // Picking for M
      if(usePaquete38) {
        precioPaquete = formatCurrency(precioBase * (1 - 0.38)); // 38% package for M if checked
      } else {
        precioPaquete = formatCurrency(precioBase * (1 - 0.37)); // 37% package for M otherwise
      }
    } else { // Cliente A (and fallback)
      precioPicking = formatCurrency(precioBase * (1 - 0.31)); // Picking for A
      if(usePaquete38) {
        precioPaquete = formatCurrency(precioBase * (1 - 0.38)); // 38% package for A if checked
      } else {
        precioPaquete = formatCurrency(precioBase * (1 - 0.36)); // 36% package for A otherwise
      }
    }
    return {
      pedidoPicking: precioPicking,
      pedidoPaquete: precioPaquete
    };
  }

  // Function to render all tables for Web app
  function renderTables() {
    if (!webTablesContainer || !webChkUnidad) return;
    let unidadTexto = webChkUnidad.checked ? "por M²" : "por Tablero";
    webTablesContainer.innerHTML = `<h2>Tablas de Precios Netos ${unidadTexto}</h2>`; // Set title

    tablesData.forEach((rows, index) => {
      const tableWrapper = document.createElement("div");
      tableWrapper.style.marginBottom = "2rem";
      tableWrapper.classList.add("table-wrapper");

      // Add remove button for this table
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Eliminar Tabla";
      removeBtn.className = "close-btn no-print";
      removeBtn.style.marginBottom = "0.5rem";
      removeBtn.style.display = "block";
      removeBtn.style.marginLeft = "auto";
      removeBtn.style.backgroundColor = "#fdd";
      removeBtn.style.color = "#a00";
      removeBtn.style.border = "1px solid #a00";
      removeBtn.style.padding = "0.2rem 0.5rem";


      removeBtn.addEventListener("click", () => {
        tablesData.splice(index, 1); // Remove data
        renderTables(); // Re-render
      });

      const table = document.createElement("table");
      table.innerHTML = generateTableHTML(rows); // Generate HTML

      tableWrapper.appendChild(removeBtn);
      tableWrapper.appendChild(table);
      webTablesContainer.appendChild(tableWrapper);
    });
  }

  // Function to generate HTML string for a single Web table
  function generateTableHTML(rows) {
    let theadHTML = "<thead><tr>";
    // Always show description first
    theadHTML += "<th>Descripción</th>";

    // Add other headers based on visibility state
    if(columns.codigo) theadHTML += `<th>${getColumnLabel("codigo")}</th>`;
    if(columns.medidas) theadHTML += `<th>${getColumnLabel("medidas")}</th>`;
    if(columns.precioBase) theadHTML += `<th>${getColumnLabel("precioBase")}</th>`;
    if(columns.pedidoPicking) theadHTML += `<th>${getColumnLabel("pedidoPicking")}</th>`;
    if(columns.pedidoPaquete) theadHTML += `<th>${getColumnLabel("pedidoPaquete")}</th>`;
    if(columns.isOutlet) theadHTML += `<th>${getColumnLabel("isOutlet")}</th>`;
    theadHTML += "</tr></thead>";

    let tbodyHTML = "<tbody>";
    const usePaquete38 = webChkPaquete38 && webChkPaquete38.checked; // Check existence

    rows.forEach(row => {
      let basePriceForCalc; // Price used for discount calculation
      // Determine base price based on unit selection (m² or Tablero)
      if(webChkUnidad && webChkUnidad.checked) { // Check existence
        basePriceForCalc = row.priceM2; // Use price per m² directly
      } else {
        // Calculate price per Tablero
        const area = calculateArea(row.largo, row.ancho);
        basePriceForCalc = area > 0 ? parseFloat((area * row.priceM2).toFixed(2)) : 0;
      }

      // Calculate discounts using the determined base price, config, and 38% option
      const discounts = calculateDiscounts(basePriceForCalc, discountConfig, usePaquete38);

      tbodyHTML += "<tr>";
      // Description cell first
      tbodyHTML += `<td>${row.descripcion}</td>`;

      // Add other data cells based on visibility state
      if(columns.codigo) tbodyHTML += `<td>${row.codigo}</td>`;
      if(columns.medidas) tbodyHTML += `<td>${row.medidas}</td>`;
      if(columns.precioBase) tbodyHTML += `<td>${basePriceForCalc.toFixed(2)} €</td>`;
      if(columns.pedidoPicking) tbodyHTML += `<td>${discounts.pedidoPicking}</td>`;
      if(columns.pedidoPaquete) tbodyHTML += `<td>${discounts.pedidoPaquete}</td>`;
      if(columns.isOutlet) tbodyHTML += `<td>${row.isOutlet}</td>`;
      tbodyHTML += "</tr>";
    });
    tbodyHTML += "</tbody>";

    return theadHTML + tbodyHTML; // Return complete table HTML
  }

   // Helper function to parse numbers (handles Spanish format with '.' thousand sep and ',' decimal)
   // Reusing the same function from JDE scope - consider moving to a global scope if needed
   function parseNumber(value) {
    if(!value || typeof value !== 'string') return 0;
    return parseFloat(value.replace(/\./g, "").replace(/,/g, ".")) || 0;
  }

  // Helper function to calculate area in square meters from mm dimensions
  // Reusing the same function from JDE scope
  function calculateArea(largo, ancho) {
    if (typeof largo !== 'number' || typeof ancho !== 'number' || largo <= 0 || ancho <= 0) {
        return 0;
    }
    return (largo / 1000) * (ancho / 1000);
  }

})(); // End of Web App IIFE


/********************* Aplicación Madera Paquetes (IIFE) *********************/
(function() {
    // DOM Elements specific to Madera App
    const maderaAppContainer = document.getElementById('maderaApp'); // Get the main container
     // Find elements *within* the maderaAppContainer to avoid selecting from other apps
    const descriptionInput = maderaAppContainer?.querySelector('#descriptionInput'); // Use optional chaining
    const priceInput = maderaAppContainer?.querySelector('#priceInput');
    const pickingTextarea = maderaAppContainer?.querySelector('#pickingDimensionsTextarea');
    const packageTextarea = maderaAppContainer?.querySelector('#packageDimensionsTextarea');
    const onlyPackageChk = maderaAppContainer?.querySelector('#onlyPackageChk');
    const use36PackageChk = maderaAppContainer?.querySelector('#use36PackageChk'); // Check this ID matches HTML
    const addBtn = maderaAppContainer?.querySelector('#addBtn');
    const clearAllBtn = maderaAppContainer?.querySelector('#clearAllBtn');
    const printBtn = maderaAppContainer?.querySelector('#printBtn'); // Note: ID collision risk
    const cardsContainer = maderaAppContainer?.querySelector('#cardsContainer');
    const toggleConfigBtn = maderaAppContainer?.querySelector('#toggleConfigBtn');
    const configSection = maderaAppContainer?.querySelector('#configSection');

    // --- Early Exit if Elements Don't Exist ---
    if (!maderaAppContainer || !descriptionInput || !priceInput || !addBtn || !cardsContainer || !configSection) {
        // console.log("Madera elements not found, skipping Madera app initialization.");
        return; // Exit this IIFE if essential elements are missing
    }
    // --- End Early Exit ---


    let woodData = []; // Array to store added wood package data

    // --- Event Listeners ---
    // Add checks for element existence before adding listeners
    if (addBtn) addBtn.addEventListener('click', addWoodPackage);
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllPackages);
    if (printBtn) printBtn.addEventListener('click', () => window.print()); // Simple print
    if (toggleConfigBtn) toggleConfigBtn.addEventListener('click', toggleConfigVisibility);

    // Load data from localStorage on init
    loadFromLocalStorage();

    // --- Functions ---

    function toggleConfigVisibility() {
        if (!configSection || !toggleConfigBtn) return;
        const isHidden = configSection.style.display === 'none';
        configSection.style.display = isHidden ? 'block' : 'none';
        toggleConfigBtn.textContent = isHidden ? '-' : '+';
    }

    function addWoodPackage() {
        // Check required elements exist
        if (!descriptionInput || !priceInput || !pickingTextarea || !packageTextarea || !onlyPackageChk || !use36PackageChk) return;

        const description = descriptionInput.value.trim();
        const basePrice = parseFloat(priceInput.value.replace(',', '.')); // Handle comma decimal
        const pickingDimensions = pickingTextarea.value.trim();
        const packageDimensions = packageTextarea.value.trim();
        const onlyPackage = onlyPackageChk.checked;
        const use36Package = use36PackageChk.checked;

        // Basic validation
        if (!description || isNaN(basePrice) || basePrice <= 0) {
            // alert('Por favor, introduce una descripción y un precio base válido.');
            console.warn('Madera: Descripción o precio base inválido.');
            return;
        }
        if (!onlyPackage && !pickingDimensions) {
            //  alert('Por favor, introduce las medidas de picking o marca "Sólo Paquete".');
             console.warn('Madera: Faltan medidas de picking.');
             return;
        }
         if (!packageDimensions) {
            //  alert('Por favor, introduce las medidas de paquete.');
             console.warn('Madera: Faltan medidas de paquete.');
             return;
         }


        const pickingData = parseDimensions(pickingDimensions, 2, -1); // col[2] for m³, last col for largo
        const packageData = parseDimensions(packageDimensions, 9, 6); // col[9] for m³, col[6] for largo

        if (!onlyPackage && pickingData.length === 0 && pickingDimensions) { // Only warn if text was provided but failed parsing
            // alert('Error al procesar las medidas de picking. Verifica el formato (separado por tabuladores).');
            console.warn('Madera: Error al procesar medidas de picking.');
            // Allow adding if picking is optional and empty, but log error if text was present
            // return; // Decide if this should prevent adding
        }
        if (packageData.length === 0 && packageDimensions) { // Only warn if text was provided but failed parsing
            // alert('Error al procesar las medidas de paquete. Verifica el formato (separado por tabuladores).');
             console.warn('Madera: Error al procesar medidas de paquete.');
            return; // Package dimensions are mandatory
        }


        const newPackage = {
            id: Date.now(), // Simple unique ID
            description,
            basePrice,
            pickingData: onlyPackage ? [] : pickingData, // Empty if only package
            packageData,
            onlyPackage,
            use36Package // Store the 36/38% preference
        };

        woodData.push(newPackage);
        renderCards();
        saveToLocalStorage();
        clearInputs();
    }

    function parseDimensions(text, m3ColIndex, largoColIndex) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const data = [];
        lines.forEach(line => {
            const cols = line.split('\t');
            const m3 = m3ColIndex < cols.length ? parseFloat(cols[m3ColIndex].replace(',', '.')) : NaN;
            // Handle negative index for last column
            const actualLargoIndex = largoColIndex < 0 ? cols.length + largoColIndex : largoColIndex;
            const largo = actualLargoIndex >= 0 && actualLargoIndex < cols.length ? parseFloat(cols[actualLargoIndex].replace(',', '.')) : NaN;

            if (!isNaN(m3) && !isNaN(largo) && m3 > 0 && largo > 0) {
                data.push({ m3, largo });
            } else {
                 console.warn(`Madera: Skipping dimension line due to invalid data: ${line}`);
            }
        });
        return data;
    }

    function calculatePrices(basePrice, m3, use36Package) {
        const pricePerUnit = basePrice * m3;
        // Apply discounts based on the 'use36Package' flag stored with the wood data
        const discountPicking = 0.34; // Example picking discount
        const discountPackage = use36Package ? 0.38 : 0.37; // 38% or 37%

        return {
            picking: (pricePerUnit * (1 - discountPicking)).toFixed(2),
            package: (pricePerUnit * (1 - discountPackage)).toFixed(2)
        };
    }

    function renderCards() {
        if (!cardsContainer) return;
        cardsContainer.innerHTML = ''; // Clear existing cards
        woodData.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'cardMadera'; // Use the specific class for Madera cards
            card.dataset.id = pkg.id;

            // --- Card Header ---
            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header'; // Use specific class

            const companyText = document.createElement('div');
            companyText.className = 'company-text'; // Use specific class
            companyText.textContent = 'Gabarró'; // Or your company name

            const contactInfo = document.createElement('div');
            contactInfo.className = 'contact-info'; // Use specific class
            contactInfo.innerHTML = `
                <strong>Marcos Sanchez</strong><br>
                Tel. 669 22 80 10<br>
                Email Consultas: marcos.sanchez@gabarro.com<br>
                Email Pedidos: ventas.galicia@gabarro.com
            `; // Add your contact details

            cardHeader.appendChild(companyText);
            cardHeader.appendChild(contactInfo);

            // --- Card Body ---
            const cardBody = document.createElement('div');

            const title = document.createElement('h4');
            title.textContent = pkg.description;
            title.style.marginBottom = '0.5rem';

            const basePriceInfo = document.createElement('p');
            basePriceInfo.textContent = `Precio Base: ${pkg.basePrice.toFixed(2)} € / m³`;
            basePriceInfo.style.marginBottom = '1rem';
            basePriceInfo.style.fontWeight = 'bold';


            // --- Tables ---
            const tablesContainer = document.createElement('div');

            // Picking Table (if not onlyPackage)
            if (!pkg.onlyPackage && pkg.pickingData.length > 0) {
                const pickingTable = createDimensionTable('Picking', pkg.pickingData, pkg.basePrice, false, pkg.use36Package); // Picking never uses 36/38% logic directly for package price column
                tablesContainer.appendChild(pickingTable);
            }

             // Package Table
            if (pkg.packageData.length > 0) {
                const packageTable = createDimensionTable('Paquete', pkg.packageData, pkg.basePrice, true, pkg.use36Package); // Package table uses the flag
                tablesContainer.appendChild(packageTable);
            }


            // --- Delete Button ---
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn no-print'; // Use specific class and no-print
            deleteBtn.textContent = 'X';
            deleteBtn.title = 'Eliminar esta madera';
            deleteBtn.onclick = () => deletePackage(pkg.id);

            // --- Assemble Card ---
            cardBody.appendChild(title);
            cardBody.appendChild(basePriceInfo);
            cardBody.appendChild(tablesContainer); // Add tables container

            card.appendChild(deleteBtn); // Add delete button
            card.appendChild(cardHeader); // Add header
            card.appendChild(cardBody);   // Add body

            cardsContainer.appendChild(card); // Add card to the main container
        });
    }

    function createDimensionTable(title, data, basePrice, isPackageTable, use36PackageForThisPkg) {
        const tableContainer = document.createElement('div');
        tableContainer.style.marginBottom = '1rem'; // Space between tables

        const tableTitle = document.createElement('h5');
        tableTitle.textContent = `Medidas (${title})`;
        tableTitle.style.marginBottom = '0.3rem';

        const table = document.createElement('table');
        table.className = 'madera-table'; // Use specific class for Madera tables

        // Determine headers based on whether it's a picking or package table
        let headers = ['Largo (m)', 'm³', 'Precio Neto (€)'];
        if (isPackageTable) {
             headers = ['Largo (m)', 'm³', `Precio Paquete (${use36PackageForThisPkg ? '38%' : '37%'})`];
        } else {
             headers = ['Largo (m)', 'm³', 'Precio Picking (34%)']; // Picking price label
        }


        table.innerHTML = `
            <thead>
                <tr>
                    ${headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${data.map(item => {
                    const prices = calculatePrices(basePrice, item.m3, use36PackageForThisPkg); // Pass the flag
                    const displayPrice = isPackageTable ? prices.package : prices.picking;
                    return `
                        <tr>
                            <td>${item.largo.toFixed(2)}</td>
                            <td>${item.m3.toFixed(3)}</td>
                            <td>${displayPrice}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;

        tableContainer.appendChild(tableTitle);
        tableContainer.appendChild(table);
        return tableContainer;
    }


    function deletePackage(id) {
        // Optional: Add confirmation dialog
        // if (confirm('¿Estás seguro de que quieres eliminar esta madera?')) {
            woodData = woodData.filter(pkg => pkg.id !== id);
            renderCards();
            saveToLocalStorage();
        // }
    }

    function clearAllPackages() {
        // Optional: Add confirmation dialog
        // if (confirm('¿Estás seguro de que quieres borrar TODAS las maderas añadidas?')) {
            woodData = [];
            renderCards();
            saveToLocalStorage();
            clearInputs(); // Optionally clear inputs too
        // }
    }

    function clearInputs() {
        if (descriptionInput) descriptionInput.value = '';
        if (priceInput) priceInput.value = '';
        if (pickingTextarea) pickingTextarea.value = '';
        if (packageTextarea) packageTextarea.value = '';
        if (onlyPackageChk) onlyPackageChk.checked = false;
        if (use36PackageChk) use36PackageChk.checked = false; // Reset 36/38% checkbox too
    }

    function saveToLocalStorage() {
        try {
            localStorage.setItem('maderaPaquetesData', JSON.stringify(woodData));
        } catch (e) {
            console.error("Error saving Madera data to localStorage:", e);
        }
    }

    function loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('maderaPaquetesData');
            if (savedData) {
                woodData = JSON.parse(savedData);
                renderCards();
            }
        } catch (e) {
            console.error("Error loading Madera data from localStorage:", e);
            woodData = []; // Reset data if loading fails
        }
    }

})(); // End of Madera Paquetes App IIFE


/********************* NUEVA Aplicación Fabrica (IIFE) *********************/
(function() {
    // DOM Elements specific to Fabrica App
    const fabricaAppContainer = document.getElementById('fabricaApp');

    // --- Early Exit if Fabrica container doesn't exist ---
    if (!fabricaAppContainer) {
        // console.log("Fabrica container not found, skipping Fabrica app initialization.");
        return; // Exit this IIFE
    }
    // --- End Early Exit ---

    // Find elements *within* the fabricaAppContainer
    const clientRadios = fabricaAppContainer.querySelectorAll('input[name="clientType"]');
    const clientInfoDiv = fabricaAppContainer.querySelector('#clientInfo');
    const quantityInput = fabricaAppContainer.querySelector('#quantity');
    const descriptionInput = fabricaAppContainer.querySelector('#description');
    const dimensionsInput = fabricaAppContainer.querySelector('#dimensions');
    const pricePvpInput = fabricaAppContainer.querySelector('#pricePvp');
    const addRowBtn = fabricaAppContainer.querySelector('#addRow');
    const clearFieldsBtn = fabricaAppContainer.querySelector('#clearFields'); // ID might clash if not careful
    const printTableBtn = fabricaAppContainer.querySelector('#printTable'); // ID might clash
    const priceTableBody = fabricaAppContainer.querySelector('#priceTable tbody'); // ID might clash
    const totalPriceCell = fabricaAppContainer.querySelector('#totalPrice'); // ID might clash

     // --- Early Exit if essential Fabrica elements don't exist ---
     if (!clientRadios.length || !clientInfoDiv || !quantityInput || !descriptionInput || !dimensionsInput || !pricePvpInput || !addRowBtn || !clearFieldsBtn || !printTableBtn || !priceTableBody || !totalPriceCell) {
        console.warn("Essential Fabrica elements not found within #fabricaApp, skipping Fabrica app initialization.");
        return; // Exit this IIFE
    }
    // --- End Early Exit ---


    // Información de descuentos por tipo de cliente
    const discounts = {
        'B0': {
            'low': { threshold: 250, discount: 0.28 },
            'high': { threshold: 1500, discount: 0.38 }
        },
        'A3': {
            'low': { threshold: 250, discount: 0.31 },
            'high': { threshold: 1500, discount: 0.41 }
        },
        'M3': {
            'low': { threshold: 250, discount: 0.34 },
            'high': { threshold: 1500, discount: 0.42 }
        }
    };

    // --- Event Listeners ---
    clientRadios.forEach(radio => {
        radio.addEventListener('change', updateClientInfo);
    });

    addRowBtn.addEventListener('click', function() {
        const quantity = parseInt(quantityInput.value) || 1;
        const description = descriptionInput.value.trim();
        const dimensions = dimensionsInput.value.trim();
        const pricePvp = parseFloat(pricePvpInput.value.replace(',', '.')) || 0; // Handle comma decimal

        if (!description || !dimensions || pricePvp <= 0) {
            // alert('Por favor, complete todos los campos correctamente.');
            console.warn('Fabrica: Campos incompletos o inválidos para añadir fila.');
            return;
        }

        // Calcular las dimensiones y el área
        let width = 0, height = 0, area = 0;
        const dimensionParts = dimensions.match(/(\d+)\s*[xX]\s*(\d+)/); // Regex to match "number x number"

        if (dimensionParts && dimensionParts.length === 3) {
            width = parseFloat(dimensionParts[1]);
            height = parseFloat(dimensionParts[2]);
            if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
                 area = (width * height) / 1000000; // Convertir de mm² a m²
            } else {
                 console.warn('Fabrica: Dimensiones inválidas después de la extracción.');
                 // alert('Dimensiones inválidas. Use el formato: anchura x altura (números positivos).');
                 return;
            }
        } else {
            // alert('Formato de medidas incorrecto. Use el formato: anchura x altura');
            console.warn('Fabrica: Formato de medidas incorrecto.');
            return;
        }

        // Calcular precios (basado en el total PVP de la línea para determinar descuento)
        const totalPvpForDiscount = pricePvp * area * quantity;
        const discount = getDiscount(totalPvpForDiscount); // Usa el total PVP para el umbral
        const priceNetPerSqm = pricePvp * (1 - discount); // Precio neto por m²
        const priceNetPerBoard = priceNetPerSqm * area; // Precio neto por tablero
        const totalNetForRow = priceNetPerBoard * quantity; // Total neto para la cantidad

        // Crear nueva fila
        const newRow = document.createElement('tr');
        // Store original PVP per m² and area in data attributes for recalculation
        newRow.dataset.originalPvp = pricePvp;
        newRow.dataset.area = area;

        newRow.innerHTML = `
            <td data-label="Cantidad">${quantity}</td>
            <td data-label="Descripción">${description}</td>
            <td data-label="Medidas (mm)">${dimensions}</td>
            <td data-label="Precio Neto (€/m²)">${priceNetPerSqm.toFixed(2)} €/m²</td>
            <td data-label="Precio Neto Tablero">${priceNetPerBoard.toFixed(2)} €</td>
            <td data-label="Total Neto">${totalNetForRow.toFixed(2)} €</td>
            <td class="no-print">
                <button class="remove-btn" title="Eliminar fila">-</button> {/* Changed to button for semantics */}
            </td>
        `;

        // Añadir funcionalidad para eliminar la fila
        const removeBtn = newRow.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                if (priceTableBody) { // Check if body exists
                    priceTableBody.removeChild(newRow);
                    updateTotal(); // Recalculate total after removing
                    updateAllRowPrices(); // Recalculate all discounts after removing a row
                }
            });
        }


        // Añadir fila a la tabla
        if (priceTableBody) { // Check if body exists
            priceTableBody.appendChild(newRow);
        }


        // Actualizar total y recalcular descuentos de todas las filas
        updateTotal();
        updateAllRowPrices(); // Recalculate all discounts after adding a new row

        // NO limpiar todos los campos, solo la cantidad vuelve a 1
        quantityInput.value = '1';
        // Opcional: Limpiar descripción, dimensiones, pvp si se desea
        // descriptionInput.value = '';
        // dimensionsInput.value = '';
        // pricePvpInput.value = '';
        descriptionInput.focus(); // Poner foco en descripción para siguiente item

    });

    // Limpiar campos al hacer clic en el botón correspondiente
    clearFieldsBtn.addEventListener('click', function() {
        clearFields();
        // También limpiar la tabla
        if (priceTableBody) priceTableBody.innerHTML = '';
        updateTotal(); // Reset total a 0.00 €
    });

    // Funcionalidad para imprimir la tabla
    printTableBtn.addEventListener('click', function() {
        window.print();
    });

    // --- Helper Functions ---

    function updateClientInfo() {
        if (!clientInfoDiv || !clientRadios.length) return;
        let clientType = '';
        clientRadios.forEach(radio => {
            if (radio.checked) {
                clientType = radio.value;
            }
        });

        const discountInfo = discounts[clientType];
        if (!discountInfo) return; // Exit if discount info not found

        clientInfoDiv.innerHTML = `
            <h3>Descuentos para cliente ${clientType}:</h3>
            <ul>
                <li>Desde ${discountInfo.low.threshold}€ a ${discountInfo.high.threshold - 1}€: ${(discountInfo.low.discount * 100).toFixed(0)}% de descuento</li>
                <li>A partir de ${discountInfo.high.threshold}€: ${(discountInfo.high.discount * 100).toFixed(0)}% de descuento</li>
            </ul>
        `;

        // Recalcular precios en tabla existente al cambiar cliente
        updateAllRowPrices();
    }

    // Función para actualizar todos los precios en las filas existentes
    function updateAllRowPrices() {
        if (!priceTableBody) return;
        const rows = priceTableBody.querySelectorAll('tr');
        const currentTotalPVP = calculateCurrentTotalPVP(); // Calcular el PVP total actual de la tabla

        rows.forEach(row => {
            // Extraer datos originales de los atributos data-*
            const quantity = parseInt(row.cells[0].textContent);
            const originalPvp = parseFloat(row.dataset.originalPvp);
            const area = parseFloat(row.dataset.area);

            if (isNaN(quantity) || isNaN(originalPvp) || isNaN(area) || area <= 0) {
                console.warn("Fabrica: Datos inválidos en la fila para recalcular", row);
                return; // Saltar esta fila si los datos son inválidos
            }

            // Recalcular con el nuevo descuento basado en el TOTAL PVP ACTUAL
            const discount = getDiscount(currentTotalPVP); // Usar el total PVP de la tabla
            const newPriceNetPerSqm = originalPvp * (1 - discount);
            const newPriceNetPerBoard = newPriceNetPerSqm * area;
            const newTotalNetForRow = newPriceNetPerBoard * quantity;

            // Actualizar celdas
            row.cells[3].textContent = `${newPriceNetPerSqm.toFixed(2)} €/m²`;
            row.cells[4].textContent = `${newPriceNetPerBoard.toFixed(2)} €`;
            row.cells[5].textContent = `${newTotalNetForRow.toFixed(2)} €`;
        });

        updateTotal(); // Actualizar el total neto final mostrado
    }

    // Función para calcular el PVP total actual de todas las filas
    function calculateCurrentTotalPVP() {
        if (!priceTableBody) return 0;
        let totalPVP = 0;
        const rows = priceTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const quantity = parseInt(row.cells[0].textContent);
            const originalPvp = parseFloat(row.dataset.originalPvp);
            const area = parseFloat(row.dataset.area);

            if (!isNaN(quantity) && !isNaN(originalPvp) && !isNaN(area) && area > 0) {
                totalPVP += originalPvp * area * quantity;
            }
        });
        return totalPVP;
    }


    // Función para calcular el descuento según tipo de cliente y el TOTAL PVP de la tabla
    function getDiscount(currentTotalPvpValue) {
        if (!clientRadios.length) return 0;
        let clientType = '';
        clientRadios.forEach(radio => {
            if (radio.checked) {
                clientType = radio.value;
            }
        });

        const discountInfo = discounts[clientType];
        if (!discountInfo) return 0; // No discount if info not found

        if (currentTotalPvpValue < discountInfo.low.threshold) {
            return 0; // Sin descuento por debajo del primer umbral
        } else if (currentTotalPvpValue < discountInfo.high.threshold) {
            return discountInfo.low.discount; // Descuento bajo
        } else {
            return discountInfo.high.discount; // Descuento alto
        }
    }

    // Función para actualizar el precio total neto mostrado en el tfoot
    function updateTotal() {
        if (!priceTableBody || !totalPriceCell) return;
        let totalNet = 0;
        const rows = priceTableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const priceCell = row.cells[5].textContent; // Celda "Total Neto" de la fila
            // Extraer solo el número, quitando " €" y convirtiendo a float
            const price = parseFloat(priceCell.replace('€', '').trim());
            if (!isNaN(price)) {
                totalNet += price;
            }
        });

        totalPriceCell.textContent = `${totalNet.toFixed(2)} €`;
    }

    // Función para limpiar los campos de entrada
    function clearFields() {
        if (quantityInput) quantityInput.value = '1';
        if (descriptionInput) descriptionInput.value = '';
        if (dimensionsInput) dimensionsInput.value = '';
        if (pricePvpInput) pricePvpInput.value = '';
    }

    // Inicializar la información del cliente al cargar
    updateClientInfo();

})(); // End of Fabrica App IIFE
