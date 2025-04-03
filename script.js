/********************* Selector Global *********************/
document.querySelectorAll('input[name="modeSelector"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    const value = e.target.value;
    const apps = ["jdeApp", "webApp", "maderaApp", "fabricaApp"];
    let targetAppId = null;

    // Determinar la app a mostrar
    if (value === "JDE") targetAppId = "jdeApp";
    else if (value === "WEB") targetAppId = "webApp";
    else if (value === "MADERA") targetAppId = "maderaApp";
    else if (value === "FABRICA") targetAppId = "fabricaApp";

    // Ocultar todas las apps y mostrar la seleccionada
    apps.forEach(appId => {
        const appElement = document.getElementById(appId);
        if (appElement) {
            appElement.style.display = (appId === targetAppId) ? "block" : "none";
        } else {
            console.warn(`Element with ID ${appId} not found.`);
        }
    });
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
  const jdeAppContainer     = document.getElementById("jdeApp"); // Container
  const jdeInputDataElem    = document.getElementById("jdeInputData");
  const jdeBtnAddTable      = document.getElementById("jdeBtnAddTable");
  const jdeBtnClearText     = document.getElementById("jdeBtnClearText");
  const jdeBtnPrint         = document.getElementById("jdeBtnPrint");
  const jdeColumnsContainer = document.getElementById("jdeColumnsContainer");
  const jdeTablesContainer  = document.getElementById("jdeTablesContainer");
  const jdeChkUnidad        = document.getElementById("jdeChkUnidad");

  // --- Early Exit if Container or Essential Elements Don't Exist ---
  if (!jdeAppContainer || !jdeInputDataElem || !jdeBtnAddTable || !jdeBtnClearText || !jdeBtnPrint || !jdeColumnsContainer || !jdeTablesContainer || !jdeChkUnidad) {
      // console.log("JDE elements not found, skipping JDE app initialization.");
      return; // Exit this IIFE
  }
  // --- End Early Exit ---


  // Event Listeners for JDE App (scoped within #jdeApp)
  jdeAppContainer.querySelectorAll('input[name="discountConfig"]').forEach(radio => {
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
    }
  });

  jdeBtnClearText.addEventListener("click", () => {
    jdeInputDataElem.value = ""; // Clear the textarea
  });

  jdeBtnPrint.addEventListener("click", () => {
    window.print(); // Trigger browser's print dialog
  });

  jdeChkUnidad.addEventListener("change", () => {
      renderTables(); // Re-render tables based on unit selection (m² or Tablero)
  });


  // Initial rendering of column checkboxes
  renderColumnsCheckboxes();

  // Function to render checkboxes for column visibility
  function renderColumnsCheckboxes() {
    jdeColumnsContainer.innerHTML = ""; // Clear existing checkboxes
    for(let colKey in columns) {
      const label = document.createElement("label");
      label.textContent = getColumnLabel(colKey, discountConfig);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = columns[colKey];
      checkbox.dataset.colKey = colKey;

      checkbox.addEventListener("change", (e) => {
        const key = e.target.dataset.colKey;
        columns[key] = e.target.checked;
        renderTables();
      });

      label.prepend(checkbox);
      jdeColumnsContainer.appendChild(label);
    }
  }

  // Function to parse input data
  function parseData() {
    const input = jdeInputDataElem.value || "";
    if(!input.trim()) return [];
    return parseDataJDE(input);
  }

  // Function to parse JDE specific data format
  function parseDataJDE(input) {
    let rows = [];
    const lines = input.split("\n");
    const cantoRows = [];
    const mainRows = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if(!trimmed) return;
      const parts = trimmed.split("\t");
      if(parts.length < 15) {
          console.warn("Skipping JDE line due to insufficient columns:", line);
          return;
      };

      const descripcion = parts[3].trim();
      const medidas = parts[4].trim();
      const largo = parseNumber(parts[5]);
      const ancho = parseNumber(parts[6]);
      const alto = parseNumber(parts[7]);
      const pvpNum = parseNumber(parts[8]);
      const stockSantiagoNum = parseNumber(parts[9]);
      const stockCentralNum = parseNumber(parts[10]);
      const unidadesPaqueteVal = (parts[14].trim() === "1") ? "" : parts[14].trim();
      let stockSantiago = "";
      let stockCentral = "";

      if (stockSantiagoNum > 0 || stockCentralNum > 0) {
        if(largo !== 1000) {
          const area = calculateArea(largo, ancho);
          if(area > 0) {
            const stSantiagoCalc = Math.floor(stockSantiagoNum / area);
            const stCentralCalc = Math.floor(stockCentralNum / area);
            if(stSantiagoCalc > 0) stockSantiago = stSantiagoCalc.toString();
            if(stCentralCalc > 0) stockCentral = stCentralCalc.toString();
          }
        } else {
          stockSantiago = stockSantiagoNum > 0 ? stockSantiagoNum.toString() : "";
          stockCentral = stockCentralNum > 0 ? stockCentralNum.toString() : "";
        }
      }

      const row = {
        descripcion, medidas, alto, pvpNum, largo, ancho,
        stockSantiago, stockCentral, unidadesPaquete: unidadesPaqueteVal
      };

      if(descripcion.toLowerCase().startsWith("canto")) cantoRows.push(row);
      else mainRows.push(row);
    });

    mainRows.sort((a, b) => a.alto - b.alto);
    rows = [...mainRows, ...cantoRows];
    return rows;
  }

  // Function to calculate discounts
  function calculateDiscounts(precioBase, currentDiscountConfig) {
    let pedidoPicking, pedidoPaquete, pedidoPaqueteFinal;
    const formatCurrency = (value) => `${value.toFixed(2)} €`;

    switch(currentDiscountConfig) {
      case "B0":
        pedidoPicking = formatCurrency(precioBase * (1 - 0.28));
        pedidoPaquete = formatCurrency(precioBase * (1 - 0.33));
        pedidoPaqueteFinal = formatCurrency(precioBase * (1 - 0.35));
        break;
      case "M3":
        pedidoPicking = formatCurrency(precioBase * (1 - 0.33));
        pedidoPaquete = formatCurrency(precioBase * (1 - 0.37));
        pedidoPaqueteFinal = formatCurrency(precioBase * (1 - 0.38));
        break;
      default: // A3
        pedidoPicking = formatCurrency(precioBase * (1 - 0.31));
        pedidoPaquete = formatCurrency(precioBase * (1 - 0.36));
        pedidoPaqueteFinal = formatCurrency(precioBase * (1 - 0.38));
        break;
    }
    return {
      pedido350: pedidoPicking,
      pedidoPaquete34: pedidoPaquete,
      pedidoPaquete36: pedidoPaqueteFinal
    };
  }

  // Function to render all tables
  function renderTables() {
    let unidadTexto = jdeChkUnidad.checked ? "por M²" : "por Tablero";
    jdeTablesContainer.innerHTML = `<h2>Tablas de Precios Netos ${unidadTexto}</h2>`;

    tablesData.forEach((rows, index) => {
      const tableWrapper = document.createElement("div");
      tableWrapper.style.marginBottom = "2rem";
      tableWrapper.classList.add("table-wrapper");

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Eliminar Tabla";
      removeBtn.className = "close-btn no-print";
      removeBtn.style.cssText = `margin-bottom: 0.5rem; display: block; margin-left: auto; background-color: #fdd; color: #a00; border: 1px solid #a00; padding: 0.2rem 0.5rem;`;

      removeBtn.addEventListener("click", () => {
        tablesData.splice(index, 1);
        renderTables();
      });

      const table = document.createElement("table");
      table.innerHTML = generateTableHTML(rows);

      tableWrapper.appendChild(removeBtn);
      tableWrapper.appendChild(table);
      jdeTablesContainer.appendChild(tableWrapper);
    });
  }

  // Function to generate HTML string for a single table
  function generateTableHTML(rows) {
    let theadHTML = "<thead><tr><th>Descripción</th>";
    if(columns.medidas) theadHTML += `<th>${getColumnLabel("medidas", discountConfig)}</th>`;
    if(columns.precioBase) theadHTML += `<th>${getColumnLabel("precioBase", discountConfig)}</th>`;
    if(columns.pedido350) theadHTML += `<th>${getColumnLabel("pedido350", discountConfig)}</th>`;
    if(columns.pedidoPaquete34) theadHTML += `<th>${getColumnLabel("pedidoPaquete34", discountConfig)}</th>`;
    if(columns.pedidoPaquete36) theadHTML += `<th>${getColumnLabel("pedidoPaquete36", discountConfig)}</th>`;
    if(columns.unidadesPaquete) theadHTML += `<th>${getColumnLabel("unidadesPaquete", discountConfig)}</th>`;
    if(columns.stockSantiago) theadHTML += `<th>${getColumnLabel("stockSantiago", discountConfig)}</th>`;
    if(columns.stockCentral) theadHTML += `<th>${getColumnLabel("stockCentral", discountConfig)}</th>`;
    theadHTML += "</tr></thead>";

    let tbodyHTML = "<tbody>";
    rows.forEach(row => {
      let basePriceForCalc;
      if(jdeChkUnidad.checked) {
        basePriceForCalc = row.pvpNum;
      } else {
        if(row.largo !== 1000) {
          const area = calculateArea(row.largo, row.ancho);
          basePriceForCalc = area > 0 ? parseFloat((area * row.pvpNum).toFixed(2)) : 0;
        } else {
          basePriceForCalc = row.pvpNum;
        }
      }

      const discounts = calculateDiscounts(basePriceForCalc, discountConfig);

      tbodyHTML += `<tr><td>${row.descripcion}</td>`;
      if(columns.medidas) tbodyHTML += `<td>${row.medidas}</td>`;
      if(columns.precioBase) tbodyHTML += `<td>${basePriceForCalc.toFixed(2)} €</td>`;
      if(columns.pedido350) tbodyHTML += `<td>${discounts.pedido350}</td>`;
      if(columns.pedidoPaquete34) tbodyHTML += `<td>${discounts.pedidoPaquete34}</td>`;
      if(columns.pedidoPaquete36) tbodyHTML += `<td>${discounts.pedidoPaquete36}</td>`;
      if(columns.unidadesPaquete) tbodyHTML += `<td>${row.unidadesPaquete}</td>`;
      if(columns.stockSantiago) tbodyHTML += `<td>${row.stockSantiago}</td>`;
      if(columns.stockCentral) tbodyHTML += `<td>${row.stockCentral}</td>`;
      tbodyHTML += "</tr>";
    });
    tbodyHTML += "</tbody>";

    return theadHTML + tbodyHTML;
  }

  // Helper function to parse numbers
  function parseNumber(value) {
    if(!value || typeof value !== 'string') return 0;
    return parseFloat(value.replace(/\./g, "").replace(/,/g, ".")) || 0;
  }

  // Helper function to calculate area
  function calculateArea(largo, ancho) {
      if (typeof largo !== 'number' || typeof ancho !== 'number' || largo <= 0 || ancho <= 0) return 0;
      return (largo / 1000) * (ancho / 1000);
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
    pedidoPicking: "Precio Picking",
    pedidoPaquete: "Precio Paquete",
    isOutlet: "Outlet"
  };

  function getColumnLabel(key) {
    return columnLabelsDefault[key] || key;
  }

  let discountConfig = "A";
  let tablesData = [];

  // DOM Elements for Web App
  const webAppContainer     = document.getElementById("webApp"); // Container
  const webInputDataElem    = document.getElementById("webInputData");
  const webBtnAddTable      = document.getElementById("webBtnAddTable");
  const webBtnClearText     = document.getElementById("webBtnClearText");
  const webBtnPrint         = document.getElementById("webBtnPrint");
  const webColumnsContainer = document.getElementById("webColumnsContainer");
  const webTablesContainer  = document.getElementById("webTablesContainer");
  const webChkUnidad        = document.getElementById("webChkUnidad");
  const webChkPaquete38     = document.getElementById("webChkPaquete38");

  // --- Early Exit if Container or Essential Elements Don't Exist ---
  if (!webAppContainer || !webInputDataElem || !webBtnAddTable || !webBtnClearText || !webBtnPrint || !webColumnsContainer || !webTablesContainer || !webChkUnidad || !webChkPaquete38) {
      // console.log("Web elements not found, skipping Web app initialization.");
      return; // Exit this IIFE
  }
  // --- End Early Exit ---

  // Event Listeners for Web App (scoped within #webApp)
  webAppContainer.querySelectorAll('input[name="discountConfigWeb"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      discountConfig = e.target.value;
      renderTables();
    });
  });

  webChkUnidad.addEventListener("change", renderTables);
  webChkPaquete38.addEventListener("change", renderTables);

  webBtnAddTable.addEventListener("click", () => {
    const newRows = parseData();
    if(newRows.length > 0) {
      tablesData.push(newRows);
      renderTables();
      webInputDataElem.value = "";
    } else {
      console.warn("No se pudieron procesar los datos Web. Verifica el formato.");
    }
  });

  webBtnClearText.addEventListener("click", () => {
    webInputDataElem.value = "";
  });

  webBtnPrint.addEventListener("click", () => {
    window.print();
  });

  // Initial rendering
  renderColumnsCheckboxes();

  function renderColumnsCheckboxes() {
    webColumnsContainer.innerHTML = "";
    for(let colKey in columns) {
      const label = document.createElement("label");
      label.textContent = getColumnLabel(colKey);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = columns[colKey];
      checkbox.dataset.colKey = colKey;

      checkbox.addEventListener("change", (e) => {
        const key = e.target.dataset.colKey;
        columns[key] = e.target.checked;
        renderTables();
      });

      label.prepend(checkbox);
      webColumnsContainer.appendChild(label);
    }
  }

  function parseData() {
    const input = webInputDataElem.value.trim();
    if (!input) return [];

    const lines = input.split("\n").map(line => line.trim()).filter(line => line !== "");
    let rows = [];

    lines.forEach(line => {
      const fields = line.split("\t");
      if (fields.length < 9) {
          console.warn("Skipping Web line due to insufficient columns:", line);
          return;
      }

      let codigo = fields[0] || "";
      let descripcionOriginal = fields[1] || "";
      let descripcion = descripcionOriginal.replace(/\s+\d+\s+\d+\s+\d+(?:[.,]\d+)?\s*$/, "").trim() || descripcionOriginal;
      let largo = parseNumber(fields[2]);
      let ancho = parseNumber(fields[3]);
      let grosor = parseNumber(fields[4]);
      let formattedGrosor = (grosor % 1 === 0) ? grosor.toString() : grosor.toFixed(2).replace(".", ",");
      let isOutlet = fields[5] && fields[5].toLowerCase().includes("outlet");
      const precioStr = fields[8] || "0";
      let priceM2 = 0;
      let precioMatch = precioStr.match(/([\d.,]+)/);
      if (precioMatch) priceM2 = parseNumber(precioMatch[1]);
      let medidas = `${largo}x${ancho}x${formattedGrosor}`;

      rows.push({
        codigo, descripcion, largo, ancho, grosor, priceM2, medidas,
        isOutlet: isOutlet ? "Sí" : "No"
      });
    });

    rows.sort((a, b) => a.grosor - b.grosor);
    return rows;
  }

  function calculateDiscounts(precioBase, currentDiscountConfig, usePaquete38) {
    let precioPicking, precioPaquete;
    const formatCurrency = (value) => `${value.toFixed(2)} €`;

    if(currentDiscountConfig === "B") {
      precioPicking = formatCurrency(precioBase * (1 - 0.28));
      precioPaquete = formatCurrency(precioBase * (1 - 0.33));
    } else if(currentDiscountConfig === "M") {
      precioPicking = formatCurrency(precioBase * (1 - 0.34));
      precioPaquete = formatCurrency(precioBase * (1 - (usePaquete38 ? 0.38 : 0.37)));
    } else { // A
      precioPicking = formatCurrency(precioBase * (1 - 0.31));
      precioPaquete = formatCurrency(precioBase * (1 - (usePaquete38 ? 0.38 : 0.36)));
    }
    return { pedidoPicking, pedidoPaquete };
  }

  function renderTables() {
    let unidadTexto = webChkUnidad.checked ? "por M²" : "por Tablero";
    webTablesContainer.innerHTML = `<h2>Tablas de Precios Netos ${unidadTexto}</h2>`;

    tablesData.forEach((rows, index) => {
      const tableWrapper = document.createElement("div");
      tableWrapper.style.marginBottom = "2rem";
      tableWrapper.classList.add("table-wrapper");

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Eliminar Tabla";
      removeBtn.className = "close-btn no-print";
      removeBtn.style.cssText = `margin-bottom: 0.5rem; display: block; margin-left: auto; background-color: #fdd; color: #a00; border: 1px solid #a00; padding: 0.2rem 0.5rem;`;

      removeBtn.addEventListener("click", () => {
        tablesData.splice(index, 1);
        renderTables();
      });

      const table = document.createElement("table");
      table.innerHTML = generateTableHTML(rows);

      tableWrapper.appendChild(removeBtn);
      tableWrapper.appendChild(table);
      webTablesContainer.appendChild(tableWrapper);
    });
  }

  function generateTableHTML(rows) {
    let theadHTML = "<thead><tr><th>Descripción</th>";
    if(columns.codigo) theadHTML += `<th>${getColumnLabel("codigo")}</th>`;
    if(columns.medidas) theadHTML += `<th>${getColumnLabel("medidas")}</th>`;
    if(columns.precioBase) theadHTML += `<th>${getColumnLabel("precioBase")}</th>`;
    if(columns.pedidoPicking) theadHTML += `<th>${getColumnLabel("pedidoPicking")}</th>`;
    if(columns.pedidoPaquete) theadHTML += `<th>${getColumnLabel("pedidoPaquete")}</th>`;
    if(columns.isOutlet) theadHTML += `<th>${getColumnLabel("isOutlet")}</th>`;
    theadHTML += "</tr></thead>";

    let tbodyHTML = "<tbody>";
    const usePaquete38 = webChkPaquete38.checked;

    rows.forEach(row => {
      let basePriceForCalc;
      if(webChkUnidad.checked) {
        basePriceForCalc = row.priceM2;
      } else {
        const area = calculateArea(row.largo, row.ancho);
        basePriceForCalc = area > 0 ? parseFloat((area * row.priceM2).toFixed(2)) : 0;
      }

      const discounts = calculateDiscounts(basePriceForCalc, discountConfig, usePaquete38);

      tbodyHTML += `<tr><td>${row.descripcion}</td>`;
      if(columns.codigo) tbodyHTML += `<td>${row.codigo}</td>`;
      if(columns.medidas) tbodyHTML += `<td>${row.medidas}</td>`;
      if(columns.precioBase) tbodyHTML += `<td>${basePriceForCalc.toFixed(2)} €</td>`;
      if(columns.pedidoPicking) tbodyHTML += `<td>${discounts.pedidoPicking}</td>`;
      if(columns.pedidoPaquete) tbodyHTML += `<td>${discounts.pedidoPaquete}</td>`;
      if(columns.isOutlet) tbodyHTML += `<td>${row.isOutlet}</td>`;
      tbodyHTML += "</tr>";
    });
    tbodyHTML += "</tbody>";

    return theadHTML + tbodyHTML;
  }

   function parseNumber(value) {
    if(!value || typeof value !== 'string') return 0;
    return parseFloat(value.replace(/\./g, "").replace(/,/g, ".")) || 0;
  }

  function calculateArea(largo, ancho) {
    if (typeof largo !== 'number' || typeof ancho !== 'number' || largo <= 0 || ancho <= 0) return 0;
    return (largo / 1000) * (ancho / 1000);
  }

})(); // End of Web App IIFE


/********************* Aplicación Madera Paquetes (IIFE) *********************/
(function() {
    // DOM Elements specific to Madera App
    const maderaAppContainer = document.getElementById('maderaApp');
    if (!maderaAppContainer) return; // Early exit if container not found

    // Find elements *within* the maderaAppContainer
    const descriptionInput = maderaAppContainer.querySelector('#descriptionInput');
    const priceInput = maderaAppContainer.querySelector('#priceInput');
    const pickingTextarea = maderaAppContainer.querySelector('#pickingDimensionsTextarea');
    const packageTextarea = maderaAppContainer.querySelector('#packageDimensionsTextarea');
    const onlyPackageChk = maderaAppContainer.querySelector('#onlyPackageChk');
    const use36PackageChk = maderaAppContainer.querySelector('#use36PackageChk');
    const addBtn = maderaAppContainer.querySelector('#addBtn');
    const clearAllBtn = maderaAppContainer.querySelector('#clearAllBtn');
    const printBtn = maderaAppContainer.querySelector('#printBtn'); // Shared ID, ensure context if needed
    const cardsContainer = maderaAppContainer.querySelector('#cardsContainer');
    const toggleConfigBtn = maderaAppContainer.querySelector('#toggleConfigBtn');
    const configSection = maderaAppContainer.querySelector('#configSection');

    // --- Early Exit if Essential Elements Don't Exist ---
    if (!descriptionInput || !priceInput || !addBtn || !cardsContainer || !configSection || !pickingTextarea || !packageTextarea || !onlyPackageChk || !use36PackageChk || !clearAllBtn || !printBtn || !toggleConfigBtn) {
        // console.log("Madera essential elements not found, skipping Madera app initialization.");
        return;
    }
    // --- End Early Exit ---


    let woodData = [];

    // --- Event Listeners ---
    addBtn.addEventListener('click', addWoodPackage);
    clearAllBtn.addEventListener('click', clearAllPackages);
    printBtn.addEventListener('click', () => window.print());
    toggleConfigBtn.addEventListener('click', toggleConfigVisibility);

    loadFromLocalStorage();

    // --- Functions ---
    function toggleConfigVisibility() {
        const isHidden = configSection.style.display === 'none';
        configSection.style.display = isHidden ? 'block' : 'none';
        toggleConfigBtn.textContent = isHidden ? '-' : '+';
    }

    function addWoodPackage() {
        const description = descriptionInput.value.trim();
        const basePrice = parseFloat(priceInput.value.replace(',', '.'));
        const pickingDimensions = pickingTextarea.value.trim();
        const packageDimensions = packageTextarea.value.trim();
        const onlyPackage = onlyPackageChk.checked;
        const use36Package = use36PackageChk.checked;

        if (!description || isNaN(basePrice) || basePrice <= 0) {
            console.warn('Madera: Descripción o precio base inválido.'); return;
        }
        if (!onlyPackage && !pickingDimensions) {
             console.warn('Madera: Faltan medidas de picking.'); return;
        }
         if (!packageDimensions) {
             console.warn('Madera: Faltan medidas de paquete.'); return;
         }

        const pickingData = parseDimensions(pickingDimensions, 2, -1);
        const packageData = parseDimensions(packageDimensions, 9, 6);

        if (!onlyPackage && pickingData.length === 0 && pickingDimensions) {
            console.warn('Madera: Error al procesar medidas de picking.');
        }
        if (packageData.length === 0 && packageDimensions) {
             console.warn('Madera: Error al procesar medidas de paquete.'); return;
        }

        const newPackage = {
            id: Date.now(), description, basePrice,
            pickingData: onlyPackage ? [] : pickingData,
            packageData, onlyPackage, use36Package
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
        const discountPicking = 0.34;
        const discountPackage = use36Package ? 0.38 : 0.37;
        return {
            picking: (pricePerUnit * (1 - discountPicking)).toFixed(2),
            package: (pricePerUnit * (1 - discountPackage)).toFixed(2)
        };
    }

    function renderCards() {
        cardsContainer.innerHTML = '';
        woodData.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'cardMadera';
            card.dataset.id = pkg.id;

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            const companyText = document.createElement('div');
            companyText.className = 'company-text';
            companyText.textContent = 'Gabarró';
            const contactInfo = document.createElement('div');
            contactInfo.className = 'contact-info';
            contactInfo.innerHTML = `<strong>Marcos Sanchez</strong><br>Tel. 669 22 80 10<br>Email Consultas: marcos.sanchez@gabarro.com<br>Email Pedidos: ventas.galicia@gabarro.com`;
            cardHeader.appendChild(companyText);
            cardHeader.appendChild(contactInfo);

            const cardBody = document.createElement('div');
            const title = document.createElement('h4');
            title.textContent = pkg.description;
            title.style.marginBottom = '0.5rem';
            const basePriceInfo = document.createElement('p');
            basePriceInfo.textContent = `Precio Base: ${pkg.basePrice.toFixed(2)} € / m³`;
            basePriceInfo.style.cssText = 'margin-bottom: 1rem; font-weight: bold;';

            const tablesContainer = document.createElement('div');
            if (!pkg.onlyPackage && pkg.pickingData.length > 0) {
                tablesContainer.appendChild(createDimensionTable('Picking', pkg.pickingData, pkg.basePrice, false, pkg.use36Package));
            }
            if (pkg.packageData.length > 0) {
                tablesContainer.appendChild(createDimensionTable('Paquete', pkg.packageData, pkg.basePrice, true, pkg.use36Package));
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn no-print';
            deleteBtn.textContent = 'X';
            deleteBtn.title = 'Eliminar esta madera';
            deleteBtn.onclick = () => deletePackage(pkg.id);

            cardBody.appendChild(title);
            cardBody.appendChild(basePriceInfo);
            cardBody.appendChild(tablesContainer);
            card.appendChild(deleteBtn);
            card.appendChild(cardHeader);
            card.appendChild(cardBody);
            cardsContainer.appendChild(card);
        });
    }

    function createDimensionTable(title, data, basePrice, isPackageTable, use36PackageForThisPkg) {
        const tableContainer = document.createElement('div');
        tableContainer.style.marginBottom = '1rem';
        const tableTitle = document.createElement('h5');
        tableTitle.textContent = `Medidas (${title})`;
        tableTitle.style.marginBottom = '0.3rem';
        const table = document.createElement('table');
        table.className = 'madera-table';

        let headers = isPackageTable
            ? ['Largo (m)', 'm³', `Precio Paquete (${use36PackageForThisPkg ? '38%' : '37%'})`]
            : ['Largo (m)', 'm³', 'Precio Picking (34%)'];

        table.innerHTML = `
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
                ${data.map(item => {
                    const prices = calculatePrices(basePrice, item.m3, use36PackageForThisPkg);
                    const displayPrice = isPackageTable ? prices.package : prices.picking;
                    return `<tr><td>${item.largo.toFixed(2)}</td><td>${item.m3.toFixed(3)}</td><td>${displayPrice}</td></tr>`;
                }).join('')}
            </tbody>`;
        tableContainer.appendChild(tableTitle);
        tableContainer.appendChild(table);
        return tableContainer;
    }

    function deletePackage(id) {
        woodData = woodData.filter(pkg => pkg.id !== id);
        renderCards();
        saveToLocalStorage();
    }

    function clearAllPackages() {
        woodData = [];
        renderCards();
        saveToLocalStorage();
        clearInputs();
    }

    function clearInputs() {
        descriptionInput.value = ''; priceInput.value = '';
        pickingTextarea.value = ''; packageTextarea.value = '';
        onlyPackageChk.checked = false; use36PackageChk.checked = false;
    }

    function saveToLocalStorage() {
        try { localStorage.setItem('maderaPaquetesData', JSON.stringify(woodData)); }
        catch (e) { console.error("Error saving Madera data to localStorage:", e); }
    }

    function loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('maderaPaquetesData');
            if (savedData) { woodData = JSON.parse(savedData); renderCards(); }
        } catch (e) { console.error("Error loading Madera data from localStorage:", e); woodData = []; }
    }

})(); // End of Madera Paquetes App IIFE


/********************* NUEVA Aplicación Fabrica (IIFE) - CORREGIDA *********************/
(function() {
    // DOM Elements specific to Fabrica App
    const fabricaAppContainer = document.getElementById('fabricaApp');

    // --- Early Exit if Fabrica container doesn't exist ---
    if (!fabricaAppContainer) {
        // console.log("Fabrica container not found, skipping Fabrica app initialization.");
        return; // Exit this IIFE
    }
    // --- End Early Exit ---

    // Find elements *within* the fabricaAppContainer using querySelector
    // This ensures we don't select elements from other apps even if IDs are the same
    const clientRadios = fabricaAppContainer.querySelectorAll('input[name="clientType"]');
    const clientInfoDiv = fabricaAppContainer.querySelector('#clientInfo');
    const quantityInput = fabricaAppContainer.querySelector('#quantity');
    const descriptionInput = fabricaAppContainer.querySelector('#description');
    const dimensionsInput = fabricaAppContainer.querySelector('#dimensions');
    const pricePvpInput = fabricaAppContainer.querySelector('#pricePvp');
    const addRowBtn = fabricaAppContainer.querySelector('#addRow');
    const clearFieldsBtn = fabricaAppContainer.querySelector('#clearFields'); // ID clash risk, but scoped now
    const printTableBtn = fabricaAppContainer.querySelector('#printTable'); // ID clash risk, but scoped now
    const priceTable = fabricaAppContainer.querySelector('#priceTable'); // Select the table itself
    const priceTableBody = priceTable?.querySelector('tbody'); // Select tbody within the table
    const totalPriceCell = priceTable?.querySelector('#totalPrice'); // Select total cell within the table

     // --- Early Exit if essential Fabrica elements don't exist ---
     // Check all elements found above
     if (!clientRadios.length || !clientInfoDiv || !quantityInput || !descriptionInput || !dimensionsInput || !pricePvpInput || !addRowBtn || !clearFieldsBtn || !printTableBtn || !priceTableBody || !totalPriceCell) {
        console.warn("Essential Fabrica elements not found within #fabricaApp, skipping Fabrica app initialization.");
        // Log which elements are missing for easier debugging
        if (!clientRadios.length) console.warn("Fabrica: clientRadios not found");
        if (!clientInfoDiv) console.warn("Fabrica: clientInfoDiv not found");
        if (!quantityInput) console.warn("Fabrica: quantityInput not found");
        // ... add checks for all other elements
        if (!totalPriceCell) console.warn("Fabrica: totalPriceCell not found");
        return; // Exit this IIFE
    }
    // --- End Early Exit ---


    // Información de descuentos por tipo de cliente (misma que antes)
    const discounts = {
        'B0': { 'low': { threshold: 250, discount: 0.28 }, 'high': { threshold: 1500, discount: 0.38 } },
        'A3': { 'low': { threshold: 250, discount: 0.31 }, 'high': { threshold: 1500, discount: 0.41 } },
        'M3': { 'low': { threshold: 250, discount: 0.34 }, 'high': { threshold: 1500, discount: 0.42 } }
    };

    // --- Event Listeners ---
    clientRadios.forEach(radio => {
        radio.addEventListener('change', updateClientInfo);
    });

    addRowBtn.addEventListener('click', handleAddRow); // Use a named function

    clearFieldsBtn.addEventListener('click', function() {
        clearFields();
        priceTableBody.innerHTML = ''; // Clear table body
        updateTotal(); // Reset total display
    });

    printTableBtn.addEventListener('click', function() {
        window.print();
    });

    // --- Main Function to Add Row ---
    function handleAddRow() {
        const quantity = parseInt(quantityInput.value) || 1;
        const description = descriptionInput.value.trim();
        const dimensions = dimensionsInput.value.trim();
        const pricePvp = parseFloat(pricePvpInput.value.replace(',', '.')) || 0;

        if (!description || !dimensions || pricePvp <= 0) {
            console.warn('Fabrica: Campos incompletos o inválidos para añadir fila.');
            return;
        }

        let width = 0, height = 0, area = 0;
        const dimensionParts = dimensions.match(/(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)/); // Allow decimals in dimensions

        if (dimensionParts && dimensionParts.length === 3) {
            width = parseFloat(dimensionParts[1].replace(',', '.')); // Handle comma decimal
            height = parseFloat(dimensionParts[2].replace(',', '.')); // Handle comma decimal
            if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
                 area = (width * height) / 1000000;
            } else {
                 console.warn('Fabrica: Dimensiones inválidas después de la extracción.'); return;
            }
        } else {
            console.warn('Fabrica: Formato de medidas incorrecto. Use: anchura x altura'); return;
        }

        // Crear nueva fila (cálculo de precio se hará en updateAllRowPrices)
        const newRow = document.createElement('tr');
        newRow.dataset.originalPvp = pricePvp; // Store PVP per m²
        newRow.dataset.area = area;
        newRow.dataset.quantity = quantity; // Store quantity

        // Initial render (prices will be updated immediately by updateAllRowPrices)
        newRow.innerHTML = `
            <td data-label="Cantidad">${quantity}</td>
            <td data-label="Descripción">${description}</td>
            <td data-label="Medidas (mm)">${dimensions}</td>
            <td data-label="Precio Neto (€/m²)">-</td>
            <td data-label="Precio Neto Tablero">-</td>
            <td data-label="Total Neto">-</td>
            <td class="no-print">
                <button class="remove-btn" title="Eliminar fila">-</button>
            </td>
        `;

        // Add remove functionality
        const removeBtn = newRow.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                priceTableBody.removeChild(newRow);
                updateAllRowPrices(); // Recalculate all discounts and total after removing
            });
        }

        priceTableBody.appendChild(newRow);

        // Recalcular todos los precios y el total después de añadir
        updateAllRowPrices();

        // Reset quantity and focus description
        quantityInput.value = '1';
        descriptionInput.focus();
    }


    // --- Helper Functions ---

    function updateClientInfo() {
        let clientType = getSelectedClientType();
        const discountInfo = discounts[clientType];
        if (!discountInfo || !clientInfoDiv) return;

        clientInfoDiv.innerHTML = `
            <h3>Descuentos para cliente ${clientType}:</h3>
            <ul>
                <li>Desde ${discountInfo.low.threshold}€ a ${discountInfo.high.threshold - 1}€: ${(discountInfo.low.discount * 100).toFixed(0)}% de descuento</li>
                <li>A partir de ${discountInfo.high.threshold}€: ${(discountInfo.high.discount * 100).toFixed(0)}% de descuento</li>
            </ul>`;

        updateAllRowPrices(); // Recalculate prices when client type changes
    }

    function updateAllRowPrices() {
        const rows = priceTableBody.querySelectorAll('tr');
        const currentTotalPVP = calculateCurrentTotalPVP(); // Calculate total PVP once

        rows.forEach(row => {
            const quantity = parseInt(row.dataset.quantity); // Use stored quantity
            const originalPvp = parseFloat(row.dataset.originalPvp);
            const area = parseFloat(row.dataset.area);

            if (isNaN(quantity) || isNaN(originalPvp) || isNaN(area) || area <= 0) {
                console.warn("Fabrica: Datos inválidos en la fila para recalcular", row);
                // Optionally clear the price cells for this invalid row
                row.cells[3].textContent = '-';
                row.cells[4].textContent = '-';
                row.cells[5].textContent = '-';
                return; // Skip calculation for this row
            }

            // Calculate discount based on the *total* PVP of the order
            const discount = getDiscount(currentTotalPVP);
            const newPriceNetPerSqm = originalPvp * (1 - discount);
            const newPriceNetPerBoard = newPriceNetPerSqm * area;
            const newTotalNetForRow = newPriceNetPerBoard * quantity;

            // Update cells
            row.cells[3].textContent = `${newPriceNetPerSqm.toFixed(2)} €/m²`;
            row.cells[4].textContent = `${newPriceNetPerBoard.toFixed(2)} €`;
            row.cells[5].textContent = `${newTotalNetForRow.toFixed(2)} €`;
            // Update quantity cell in case it was edited (though not implemented here)
            row.cells[0].textContent = quantity;
        });

        updateTotal(); // Update the final total net price in tfoot
    }

    function calculateCurrentTotalPVP() {
        let totalPVP = 0;
        const rows = priceTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const quantity = parseInt(row.dataset.quantity);
            const originalPvp = parseFloat(row.dataset.originalPvp);
            const area = parseFloat(row.dataset.area);

            if (!isNaN(quantity) && !isNaN(originalPvp) && !isNaN(area) && area > 0) {
                totalPVP += originalPvp * area * quantity;
            }
        });
        return totalPVP;
    }

    function getSelectedClientType() {
        let clientType = 'B0'; // Default
        clientRadios.forEach(radio => {
            if (radio.checked) {
                clientType = radio.value;
            }
        });
        return clientType;
    }

    function getDiscount(currentTotalPvpValue) {
        let clientType = getSelectedClientType();
        const discountInfo = discounts[clientType];
        if (!discountInfo) return 0;

        if (currentTotalPvpValue < discountInfo.low.threshold) return 0;
        if (currentTotalPvpValue < discountInfo.high.threshold) return discountInfo.low.discount;
        return discountInfo.high.discount;
    }

    function updateTotal() {
        let totalNet = 0;
        const rows = priceTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const priceText = row.cells[5].textContent; // "Total Neto" cell
            const price = parseFloat(priceText.replace('€', '').trim());
            if (!isNaN(price)) {
                totalNet += price;
            }
        });
        totalPriceCell.textContent = `${totalNet.toFixed(2)} €`;
    }

    function clearFields() {
        if (quantityInput) quantityInput.value = '1';
        if (descriptionInput) descriptionInput.value = '';
        if (dimensionsInput) dimensionsInput.value = '';
        if (pricePvpInput) pricePvpInput.value = '';
    }

    // Initialize client info and potentially load saved data on start
    updateClientInfo();
    // Add loadFromLocalStorage() if needed for Fabrica

})(); // End of Fabrica App IIFE
