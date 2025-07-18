"use strict"; // Ayuda a detectar errores comunes

/********************* Selector Global *********************/
document.addEventListener('DOMContentLoaded', () => { // Esperar a que el DOM esté listo

    const modeRadios = document.querySelectorAll('input[name="modeSelector"]');
    const appContainers = {
        JDE: document.getElementById("jdeApp"),
        WEB: document.getElementById("webApp"),
        MADERA: document.getElementById("maderaApp"),
        FABRICA: document.getElementById("fabricaApp")
    };

    function switchMode(selectedValue) {
        // console.log("Switching mode to:", selectedValue); // Para depuración
        for (const mode in appContainers) {
            if (appContainers[mode]) {
                appContainers[mode].style.display = (mode === selectedValue) ? "block" : "none";
            } else {
                console.warn(`App container for mode ${mode} not found!`);
            }
        }
    }

    modeRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            switchMode(e.target.value);
        });
        // Asegurar estado inicial correcto basado en 'checked'
        if (radio.checked) {
            switchMode(radio.value);
        }
    });

    // Inicializar visibilidad al cargar (por si acaso el 'checked' no dispara change)
    const initialMode = document.querySelector('input[name="modeSelector"]:checked');
    if (initialMode) {
        switchMode(initialMode.value);
    } else if (modeRadios.length > 0) {
        // Si ninguno está chequeado por defecto (raro), mostrar el primero
        modeRadios[0].checked = true;
        switchMode(modeRadios[0].value);
    }

    /********************* Aplicación JDE (IIFE) *********************/
    (function() {
        // State
        let columns = { precioBase: true, pedido350: true, pedidoPickingMun: true, pedidoPaquete34: true, pedidoPaquete36: true, unidadesPaquete: true, stockSantiago: true, stockCentral: true, medidas: true };
        const columnLabelsDefault = { precioBase: "Precio Base", pedidoPickingMun: "Pedido Picking MUN", unidadesPaquete: "Unidades Paquete", stockSantiago: "Stock Santiago", stockCentral: "Stock Central", medidas: "Medidas" };
        let discountConfig = "A3";
        let tablesData = [];

        // DOM Elements
        const jdeAppContainer = document.getElementById("jdeApp");
        if (!jdeAppContainer) return; // Salir si el contenedor principal no existe

        const jdeInputDataElem = document.getElementById("jdeInputData");
        const jdeBtnAddTable = document.getElementById("jdeBtnAddTable");
        const jdeBtnClearText = document.getElementById("jdeBtnClearText");
        const jdeBtnPrint = document.getElementById("jdeBtnPrint");
        const jdeColumnsContainer = document.getElementById("jdeColumnsContainer");
        const jdeTablesContainer = document.getElementById("jdeTablesContainer");
        const jdeChkUnidad = document.getElementById("jdeChkUnidad");
        const discountRadios = jdeAppContainer.querySelectorAll('input[name="discountConfig"]');

        // Early exit if essential elements are missing
        if (!jdeInputDataElem || !jdeBtnAddTable || !jdeBtnClearText || !jdeBtnPrint || !jdeColumnsContainer || !jdeTablesContainer || !jdeChkUnidad || discountRadios.length === 0) {
            console.error("JDE App: Missing essential HTML elements. Aborting initialization.");
            return;
        }

        // Event Listeners
        discountRadios.forEach(radio => {
            radio.addEventListener("change", (e) => {
                discountConfig = e.target.value;
                renderColumnsCheckboxes();
                renderTables();
            });
            if (radio.checked) discountConfig = radio.value; // Set initial value
        });

        jdeBtnAddTable.addEventListener("click", () => {
            // console.log("JDE Add Table clicked"); // Debug
            const newRows = parseData();
            if (newRows && newRows.length > 0) {
                tablesData.push(newRows);
                renderTables();
                jdeInputDataElem.value = ""; // Clear input after adding
            } else {
                 console.warn("JDE: No data parsed or no rows generated.");
                 // alert("No se pudieron procesar los datos JDE. Verifica el formato."); // Opcional: feedback visual
            }
        });

        jdeBtnClearText.addEventListener("click", () => { jdeInputDataElem.value = ""; });
        jdeBtnPrint.addEventListener("click", () => { window.print(); });
        jdeChkUnidad.addEventListener("change", renderTables);

        // --- Helper Functions ---
        function getColumnLabel(key) {
            if (key === "pedido350") return "Pedido Picking";
            if (key === "pedidoPickingMun") return "Pedido Picking MUN";
            if (key === "pedidoPaquete34") return "Pedido Paquete";
            if (key === "pedidoPaquete36") {
                if (discountConfig === "B0") return "Pedido Paquete 35%";
                return "Pedido Paquete 38%"; // A3, M3
            }
            return columnLabelsDefault[key] || key;
        }

        function renderColumnsCheckboxes() {
            jdeColumnsContainer.innerHTML = "";
            for (let colKey in columns) {
                if (colKey === 'pedidoPickingMun' && discountConfig !== 'A3') continue;
                const label = document.createElement("label");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = columns[colKey];
                checkbox.dataset.colKey = colKey; // Guardar key para el listener
                checkbox.addEventListener("change", (e) => {
                    columns[e.target.dataset.colKey] = e.target.checked;
                    renderTables();
                });
                label.append(checkbox, " " + getColumnLabel(colKey)); // Añadir texto después
                jdeColumnsContainer.appendChild(label);
            }
        }

        function parseData() {
            const input = jdeInputDataElem.value || "";
            if (!input.trim()) return [];
            try { // Añadir try-catch para el parsing
                 return parseDataJDE(input);
            } catch (error) {
                console.error("Error parsing JDE data:", error);
                alert("Error al procesar los datos JDE. Verifique el formato y la consola.");
                return [];
            }
        }

        function parseDataJDE(input) {
            let rows = [];
            const lines = input.split("\n");
            const cantoRows = [];
            const mainRows = [];
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;
                const parts = trimmed.split("\t");
                // Ajustar validación si la estructura de columnas es fija
                if (parts.length < 15) {
                     console.warn("Skipping JDE line due to insufficient columns:", line);
                     return;
                };

                const descripcion = parts[3] ? parts[3].trim() : '';
                const medidas = parts[4] ? parts[4].trim() : '';
                const largo = parseNumber(parts[5]);
                const ancho = parseNumber(parts[6]);
                const alto = parseNumber(parts[7]); // Grosor, usado para ordenar
                const pvpNum = parseNumber(parts[8]);
                const stockSantiagoNum = parseNumber(parts[9]);
                const stockCentralNum = parseNumber(parts[10]);
                // Columna 14 (índice 13) es a veces 'Precio Paquete' - ignoramos aquí
                // Columna 15 (índice 14) es 'Unidades Paquete' (0 o 1 si no aplica)
                const unidadesPaqueteVal = (parts[14] && parts[14].trim() !== "1" && parts[14].trim() !== "0") ? parts[14].trim() : "";

                let stockSantiago = "";
                let stockCentral = "";

                // Calcular stock en piezas si es tablero (largo != 1000)
                if (largo !== 1000 && largo > 0 && ancho > 0) {
                    const area = calculateArea(largo, ancho);
                    if (area > 0) {
                        if (stockSantiagoNum > 0) stockSantiago = Math.floor(stockSantiagoNum / area).toString();
                        if (stockCentralNum > 0) stockCentral = Math.floor(stockCentralNum / area).toString();
                    }
                } else { // Si es canto (largo=1000) u otro, mostrar valor directo
                    if(stockSantiagoNum > 0) stockSantiago = stockSantiagoNum.toString();
                    if(stockCentralNum > 0) stockCentral = stockCentralNum.toString();
                }


                const row = {
                    descripcion, medidas, alto, pvpNum, largo, ancho,
                    stockSantiago, stockCentral, unidadesPaquete: unidadesPaqueteVal
                };

                if (descripcion.toLowerCase().startsWith("canto")) cantoRows.push(row);
                else mainRows.push(row);
            });

            mainRows.sort((a, b) => a.alto - b.alto); // Ordenar por grosor
            rows = [...mainRows, ...cantoRows];
            return rows;
        }

        function calculateDiscounts(precioBase) {
            let pedidoPicking, pedidoPaquete, pedidoPaqueteFinal;
            let pedidoPickingMun; // Sólo para A3
            const formatCurrency = (value) => `${value.toFixed(2)} €`;

            switch (discountConfig) {
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
                    pedidoPickingMun = formatCurrency(precioBase * (1 - 0.33));
                    pedidoPaquete = formatCurrency(precioBase * (1 - 0.36));
                    pedidoPaqueteFinal = formatCurrency(precioBase * (1 - 0.38));
                    break;
            }

            const discounts = {
                pedido350: pedidoPicking,
                pedidoPaquete34: pedidoPaquete,
                pedidoPaquete36: pedidoPaqueteFinal
            };
            if (discountConfig === "A3") {
                discounts.pedidoPickingMun = pedidoPickingMun;
            }
            return discounts;
        }

        function renderTables() {
            let unidadTexto = jdeChkUnidad.checked ? "por m²" : "por Tablero";
            jdeTablesContainer.innerHTML = `<h2>Tablas de Precios Netos ${unidadTexto}</h2>`; // Reset

            if (tablesData.length === 0) {
                 jdeTablesContainer.innerHTML += "<p>No hay tablas para mostrar. Pega datos y pulsa 'Agregar Tabla'.</p>";
                 return;
            }

            tablesData.forEach((rows, index) => {
                const tableWrapper = document.createElement("div");
                tableWrapper.className = "table-wrapper"; // Para scroll si es necesario
                tableWrapper.style.marginBottom = "2rem";

                const removeBtn = document.createElement("button");
                removeBtn.textContent = "Eliminar Tabla"; // Más descriptivo
                removeBtn.className = "close-btn no-print"; // Reutilizar clase CSS
                removeBtn.addEventListener("click", () => {
                    tablesData.splice(index, 1);
                    renderTables(); // Re-render después de eliminar
                });

                const table = document.createElement("table");
                try { // Try-catch para generación de HTML tabla
                    table.innerHTML = generateTableHTML(rows);
                } catch(error) {
                    console.error("Error generating JDE table HTML:", error, "for rows:", rows);
                    table.innerHTML = "<tr><td>Error al generar esta tabla</td></tr>";
                }


                tableWrapper.appendChild(removeBtn);
                tableWrapper.appendChild(table);
                jdeTablesContainer.appendChild(tableWrapper);
            });
        }

        function generateTableHTML(rows) {
            let theadHTML = "<thead><tr><th>Descripción</th>";
            if (columns.medidas) theadHTML += `<th>${getColumnLabel("medidas")}</th>`;
            if (columns.precioBase) theadHTML += `<th>${getColumnLabel("precioBase")}</th>`;
            if (columns.pedido350) theadHTML += `<th>${getColumnLabel("pedido350")}</th>`;
            if (columns.pedidoPickingMun && discountConfig === 'A3') theadHTML += `<th>${getColumnLabel("pedidoPickingMun")}</th>`;
            if (columns.pedidoPaquete34) theadHTML += `<th>${getColumnLabel("pedidoPaquete34")}</th>`;
            if (columns.pedidoPaquete36) theadHTML += `<th>${getColumnLabel("pedidoPaquete36")}</th>`;
            if (columns.unidadesPaquete) theadHTML += `<th>${getColumnLabel("unidadesPaquete")}</th>`;
            if (columns.stockSantiago) theadHTML += `<th>${getColumnLabel("stockSantiago")}</th>`;
            if (columns.stockCentral) theadHTML += `<th>${getColumnLabel("stockCentral")}</th>`;
            theadHTML += "</tr></thead>";

            let tbodyHTML = "<tbody>";
            rows.forEach(row => {
                let basePriceForCalc;
                // Determinar precio base según unidad (m² o tablero)
                if (jdeChkUnidad.checked) {
                    basePriceForCalc = row.pvpNum; // Precio por m²
                } else { // Precio por tablero
                    if (row.largo !== 1000 && row.largo > 0 && row.ancho > 0) { // Es tablero estándar
                        const area = calculateArea(row.largo, row.ancho);
                        basePriceForCalc = area > 0 ? parseFloat((area * row.pvpNum).toFixed(2)) : 0;
                    } else { // Es canto u otro
                        basePriceForCalc = row.pvpNum; // Usar el PVP directo
                    }
                }

                const discounts = calculateDiscounts(basePriceForCalc);

                tbodyHTML += `<tr><td>${row.descripcion}</td>`;
                if (columns.medidas) tbodyHTML += `<td>${row.medidas}</td>`;
                if (columns.precioBase) tbodyHTML += `<td>${basePriceForCalc.toFixed(2)} €</td>`;
                if (columns.pedido350) tbodyHTML += `<td>${discounts.pedido350}</td>`;
                if (columns.pedidoPickingMun && discountConfig === 'A3') tbodyHTML += `<td>${discounts.pedidoPickingMun}</td>`;
                if (columns.pedidoPaquete34) tbodyHTML += `<td>${discounts.pedidoPaquete34}</td>`;
                if (columns.pedidoPaquete36) tbodyHTML += `<td>${discounts.pedidoPaquete36}</td>`;
                if (columns.unidadesPaquete) tbodyHTML += `<td>${row.unidadesPaquete}</td>`;
                if (columns.stockSantiago) tbodyHTML += `<td>${row.stockSantiago}</td>`;
                if (columns.stockCentral) tbodyHTML += `<td>${row.stockCentral}</td>`;
                tbodyHTML += "</tr>";
            });
            tbodyHTML += "</tbody>";

            return theadHTML + tbodyHTML;
        }

        function parseNumber(value) {
            if (!value || typeof value !== 'string') return 0;
            // Limpiar puntos (miles) y reemplazar coma decimal por punto
            return parseFloat(value.replace(/\./g, "").replace(/,/g, ".")) || 0;
        }

        function calculateArea(largo, ancho) {
            if (typeof largo !== 'number' || typeof ancho !== 'number' || largo <= 0 || ancho <= 0) return 0;
            return (largo / 1000) * (ancho / 1000); // Convertir mm a m
        }

        // Initial Render
        renderColumnsCheckboxes();
        renderTables(); // Renderizar estado inicial (vacío)

    })(); // End of JDE App IIFE

    /********************* Aplicación Web (IIFE) *********************/
    (function() {
        // State
        let columns = { codigo: true, medidas: true, precioBase: true, pedidoPicking: true, pedidoPaquete: true, isOutlet: true };
        const columnLabelsDefault = { codigo: "Código", medidas: "Medidas", precioBase: "Precio Base", pedidoPicking: "Precio Picking", pedidoPaquete: "Precio Paquete", isOutlet: "Outlet" };
        let discountConfig = "A";
        let tablesData = [];

        // DOM Elements
        const webAppContainer = document.getElementById("webApp");
        if (!webAppContainer) return;

        const webInputDataElem = document.getElementById("webInputData");
        const webBtnAddTable = document.getElementById("webBtnAddTable");
        const webBtnClearText = document.getElementById("webBtnClearText");
        const webBtnPrint = document.getElementById("webBtnPrint");
        const webColumnsContainer = document.getElementById("webColumnsContainer");
        const webTablesContainer = document.getElementById("webTablesContainer");
        const webChkUnidad = document.getElementById("webChkUnidad");
        const webChkPaquete38 = document.getElementById("webChkPaquete38");
        const discountRadiosWeb = webAppContainer.querySelectorAll('input[name="discountConfigWeb"]');

        // Early exit
        if (!webInputDataElem || !webBtnAddTable || !webBtnClearText || !webBtnPrint || !webColumnsContainer || !webTablesContainer || !webChkUnidad || !webChkPaquete38 || discountRadiosWeb.length === 0) {
             console.error("Web App: Missing essential HTML elements. Aborting initialization.");
             return;
        }

        // Event Listeners
        discountRadiosWeb.forEach(radio => {
            radio.addEventListener("change", (e) => {
                discountConfig = e.target.value;
                // renderColumnsCheckboxes(); // No depende del descuento en Web
                renderTables();
            });
             if (radio.checked) discountConfig = radio.value; // Initial value
        });

        webChkUnidad.addEventListener("change", renderTables);
        webChkPaquete38.addEventListener("change", renderTables);

        webBtnAddTable.addEventListener("click", () => {
             // console.log("Web Add Table clicked"); // Debug
            const newRows = parseData();
             if (newRows && newRows.length > 0) {
                 tablesData.push(newRows);
                 renderTables();
                 webInputDataElem.value = "";
            } else {
                 console.warn("Web: No data parsed or no rows generated.");
                 // alert("No se pudieron procesar los datos Web. Verifica el formato.");
             }
        });

        webBtnClearText.addEventListener("click", () => { webInputDataElem.value = ""; });
        webBtnPrint.addEventListener("click", () => { window.print(); });

        // --- Helper Functions ---
         function getColumnLabel(key) { // Mantenida por si se necesita en futuro
             return columnLabelsDefault[key] || key;
         }

        function renderColumnsCheckboxes() {
            webColumnsContainer.innerHTML = "";
            for (let colKey in columns) {
                const label = document.createElement("label");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = columns[colKey];
                checkbox.dataset.colKey = colKey;
                checkbox.addEventListener("change", (e) => {
                    columns[e.target.dataset.colKey] = e.target.checked;
                    renderTables();
                });
                label.append(checkbox, " " + getColumnLabel(colKey));
                webColumnsContainer.appendChild(label);
            }
        }

        function parseData() {
            const input = webInputDataElem.value.trim();
            if (!input) return [];
            try { // Try-catch
                 return parseDataWeb(input);
            } catch(error) {
                console.error("Error parsing Web data:", error);
                alert("Error al procesar los datos Web. Verifique el formato y la consola.");
                return [];
            }

        }

        function parseDataWeb(input){
             const lines = input.split("\n").map(line => line.trim()).filter(line => line !== "");
             let rows = [];
             lines.forEach(line => {
                 const fields = line.split("\t");
                 // Asumir estructura: Cod[0] Desc[1] Largo[2] Ancho[3] Grosor[4] Outlet[5] ?? ?? Precio[8]
                 if (fields.length < 9) {
                      console.warn("Skipping Web line due to insufficient columns:", line);
                      return;
                 }

                 let codigo = fields[0] || "";
                 let descripcionOriginal = fields[1] || "";
                 // Quitar medidas al final de la descripción (si existen)
                 let descripcion = descripcionOriginal.replace(/\s+\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*[xX]\s*\d+(?:[.,]\d+)?\s*$/, "").trim() || descripcionOriginal;
                 let largo = parseNumber(fields[2]);
                 let ancho = parseNumber(fields[3]);
                 let grosor = parseNumber(fields[4]); // Usado para ordenar
                 let formattedGrosor = (grosor % 1 === 0) ? grosor.toString() : grosor.toFixed(2).replace(".", ","); // Para mostrar
                 let isOutlet = fields[5] && fields[5].toLowerCase().includes("outlet");
                 const precioStr = fields[8] || "0";
                 let priceM2 = 0;
                 let precioMatch = precioStr.match(/([\d.,]+)/); // Extraer número
                 if (precioMatch) priceM2 = parseNumber(precioMatch[1]);

                 let medidas = `${largo}x${ancho}x${formattedGrosor}`; // Formato visual

                 rows.push({
                     codigo, descripcion, largo, ancho, grosor, priceM2, medidas,
                     isOutlet: isOutlet ? "Sí" : "No"
                 });
             });

             rows.sort((a, b) => a.grosor - b.grosor); // Ordenar por grosor
             return rows;
        }

        function calculateDiscounts(precioBase) {
            let precioPicking, precioPaquete;
            const formatCurrency = (value) => `${value.toFixed(2)} €`;
            const usePaquete38 = webChkPaquete38.checked; // Leer estado del checkbox

            if (discountConfig === "B") {
                precioPicking = formatCurrency(precioBase * (1 - 0.28));
                precioPaquete = formatCurrency(precioBase * (1 - 0.33));
            } else if (discountConfig === "M") {
                precioPicking = formatCurrency(precioBase * (1 - 0.34)); // Original tenía 0.34
                precioPaquete = formatCurrency(precioBase * (1 - (usePaquete38 ? 0.38 : 0.37)));
            } else { // Cliente A
                precioPicking = formatCurrency(precioBase * (1 - 0.31));
                precioPaquete = formatCurrency(precioBase * (1 - (usePaquete38 ? 0.38 : 0.36)));
            }
            return { pedidoPicking, pedidoPaquete };
        }

        function renderTables() {
            let unidadTexto = webChkUnidad.checked ? "por m²" : "por Tablero";
            webTablesContainer.innerHTML = `<h2>Tablas de Precios Netos ${unidadTexto}</h2>`;

            if (tablesData.length === 0) {
                webTablesContainer.innerHTML += "<p>No hay tablas para mostrar. Pega datos y pulsa 'Agregar Tabla'.</p>";
                return;
            }

            tablesData.forEach((rows, index) => {
                const tableWrapper = document.createElement("div");
                tableWrapper.className = "table-wrapper";
                tableWrapper.style.marginBottom = "2rem";

                const removeBtn = document.createElement("button");
                removeBtn.textContent = "Eliminar Tabla";
                removeBtn.className = "close-btn no-print";
                removeBtn.addEventListener("click", () => {
                    tablesData.splice(index, 1);
                    renderTables();
                });

                const table = document.createElement("table");
                 try {
                    table.innerHTML = generateTableHTML(rows);
                 } catch(error) {
                    console.error("Error generating Web table HTML:", error, "for rows:", rows);
                    table.innerHTML = "<tr><td>Error al generar esta tabla</td></tr>";
                 }

                tableWrapper.appendChild(removeBtn);
                tableWrapper.appendChild(table);
                webTablesContainer.appendChild(tableWrapper);
            });
        }

        function generateTableHTML(rows) {
            // Construir thead basado en 'columns' visibles
            let theadHTML = "<thead><tr>";
            // El orden puede variar aquí si se quiere diferente al objeto 'columns'
            if (columns.codigo) theadHTML += `<th>${getColumnLabel("codigo")}</th>`;
            theadHTML += "<th>Descripción</th>"; // Descripción siempre visible?
            if (columns.medidas) theadHTML += `<th>${getColumnLabel("medidas")}</th>`;
            if (columns.precioBase) theadHTML += `<th>${getColumnLabel("precioBase")}</th>`;
            if (columns.pedidoPicking) theadHTML += `<th>${getColumnLabel("pedidoPicking")}</th>`;
            if (columns.pedidoPaquete) theadHTML += `<th>${getColumnLabel("pedidoPaquete")}</th>`;
            if (columns.isOutlet) theadHTML += `<th>${getColumnLabel("isOutlet")}</th>`;
            theadHTML += "</tr></thead>";

            let tbodyHTML = "<tbody>";
            rows.forEach(row => {
                let basePriceForCalc;
                // Calcular precio base según unidad (m² o tablero)
                if (webChkUnidad.checked || row.descripcion.toLowerCase().includes("canto")) {
                    // Usar precio por m2 para unidad m2 O si es un canto
                    basePriceForCalc = row.priceM2;
                } else { // Precio por tablero
                    const area = calculateArea(row.largo, row.ancho);
                    basePriceForCalc = area > 0 ? parseFloat((area * row.priceM2).toFixed(2)) : 0;
                }

                const discounts = calculateDiscounts(basePriceForCalc);

                // Omitir precio paquete para cantos
                 if (row.descripcion.toLowerCase().includes("canto")) {
                    discounts.pedidoPaquete = "N/A"; // O simplemente dejar vacío
                 }

                tbodyHTML += `<tr>`;
                if (columns.codigo) tbodyHTML += `<td>${row.codigo}</td>`;
                tbodyHTML += `<td>${row.descripcion}</td>`; // Descripción
                if (columns.medidas) tbodyHTML += `<td>${row.medidas}</td>`;
                if (columns.precioBase) tbodyHTML += `<td>${basePriceForCalc.toFixed(2)} €</td>`;
                if (columns.pedidoPicking) tbodyHTML += `<td>${discounts.pedidoPicking}</td>`;
                if (columns.pedidoPaquete) tbodyHTML += `<td>${discounts.pedidoPaquete}</td>`;
                if (columns.isOutlet) tbodyHTML += `<td>${row.isOutlet}</td>`;
                tbodyHTML += `</tr>`;
            });
            tbodyHTML += "</tbody>";

            return theadHTML + tbodyHTML;
        }

        function parseNumber(value) { // Misma función que en JDE
            if (!value || typeof value !== 'string') return 0;
            return parseFloat(value.replace(/\./g, "").replace(/,/g, ".")) || 0;
        }

        function calculateArea(largo, ancho) { // Misma función que en JDE
            if (typeof largo !== 'number' || typeof ancho !== 'number' || largo <= 0 || ancho <= 0) return 0;
            return (largo / 1000) * (ancho / 1000);
        }

        // Initial Render
        renderColumnsCheckboxes();
        renderTables();

    })(); // End of Web App IIFE


    /********************* Aplicación Madera Paquetes (IIFE) - Adaptada *********************/
    (function() {
        // State
        let woodData = []; // Array para guardar los datos de las maderas añadidas

        // DOM Elements (Usando IDs únicos definidos en el nuevo HTML)
        const maderaAppContainer = document.getElementById('maderaApp');
        if (!maderaAppContainer) return; // Salir si el contenedor principal no existe

        const toggleConfigBtn = document.getElementById("maderaToggleConfigBtn");
        const configSection = document.getElementById("maderaConfigSection");
        const onlyPackageChk = document.getElementById("maderaOnlyPackageChk");
        const use38PackageChk = document.getElementById("maderaUse38PackageChk"); // Corregido ID
        const descriptionInput = document.getElementById("maderaDescriptionInput");
        const priceInput = document.getElementById("maderaPriceInput");
        const pickingTextarea = document.getElementById("maderaPickingDimensionsTextarea");
        const packageTextarea = document.getElementById("maderaPackageDimensionsTextarea");
        const addBtn = document.getElementById("maderaAddBtn");
        const clearAllBtn = document.getElementById("maderaClearAllBtn");
        const printBtn = document.getElementById("maderaPrintBtn");
        const cardsContainer = document.getElementById("maderaCardsContainer");

        // Early exit
        if (!toggleConfigBtn || !configSection || !onlyPackageChk || !use38PackageChk || !descriptionInput || !priceInput || !pickingTextarea || !packageTextarea || !addBtn || !clearAllBtn || !printBtn || !cardsContainer) {
            console.error("Madera App: Missing essential HTML elements. Aborting initialization.");
            return;
        }

        // --- Event Listeners ---
        toggleConfigBtn.addEventListener('click', toggleConfigVisibility);
        addBtn.addEventListener('click', addWoodPackage);
        clearAllBtn.addEventListener('click', clearAllInputsAndData); // Cambiado para borrar también datos
        printBtn.addEventListener('click', () => window.print());

        // --- Functions ---

        // Funciones de ayuda específicas de Madera (del código original)
        function parseNumberES(val) { // Necesaria para procesar precios/medidas madera
            if (!val || typeof val !== 'string') return 0;
            val = val.replace(/\s+/g, ""); // Quitar espacios
            // Asumir que la coma es decimal si existe
            if (val.includes(",")) {
                val = val.replace(/\./g, ""); // Quitar puntos de miles
                val = val.replace(",", "."); // Reemplazar coma decimal
            }
            // Si no hay coma, asumir que el punto es decimal (si existe)
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        }

        function formatNumberES_Price(val) { // Formato para precios en Euros
             if (typeof val !== 'number') val = parseFloat(val) || 0;
             return val.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        function formatNumberES_M3(val) { // Formato para m³
             if (typeof val !== 'number') val = parseFloat(val) || 0;
             return val.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        }
         function formatNumberES_Length(val) { // Formato para largos (sin decimales)
             if (typeof val !== 'number') val = parseFloat(val) || 0;
             return Math.round(val).toLocaleString("es-ES");
         }


        function toggleConfigVisibility() {
            const isHidden = configSection.style.display === 'none';
            configSection.style.display = isHidden ? 'block' : 'none';
            toggleConfigBtn.textContent = isHidden ? '-' : '+';
        }

        function addWoodPackage() {
            // console.log("Madera Add Wood clicked"); // Debug
            const description = descriptionInput.value.trim();
            const basePrice = parseNumberES(priceInput.value); // Usar parser ES
            const pickingDimensionsRaw = pickingTextarea.value.trim();
            const packageDimensionsRaw = packageTextarea.value.trim();
            const onlyPackage = onlyPackageChk.checked;
            const use38Package = use38PackageChk.checked; // Usar ID corregido

            if (!description || basePrice <= 0) {
                alert('Madera: Introduce una descripción y un precio base válido (€/m³).');
                return;
            }
            if (!onlyPackage && !pickingDimensionsRaw) {
                 alert('Madera: Introduce las dimensiones de picking o marca "Sólo Paquete".');
                 return;
            }
             if (!packageDimensionsRaw) {
                 alert('Madera: Introduce las dimensiones de paquete.');
                 return;
             }

            // Procesar dimensiones (adaptar de funciones originales si es necesario)
            // Simplificamos: guardamos texto raw y procesamos al renderizar
            // Opcional: parsear aquí para validación temprana

            const newPackage = {
                id: Date.now(), // ID único para posible eliminación futura
                description,
                basePrice,
                pickingDimensionsRaw,
                packageDimensionsRaw,
                onlyPackage,
                use38Package
            };

            woodData.push(newPackage);
            renderCards();
            // clearInputs(); // Opcional: Limpiar campos después de añadir
            saveToLocalStorage(); // Guardar estado
        }

        // Función adaptada del original para parsear datos JDE y generar tabla HTML
        function generateDimensionTable(title, dimensionsRaw, isPackageTable, basePrice, use38PackageForThisPkg) {
             const lines = dimensionsRaw.split('\n').map(l => l.trim()).filter(l => l);
             if (!lines.length) return ""; // No hay datos

             let html = `<div class="dimension-table-container">
                         <h5>Medidas (${title})</h5>
                         <table class="madera-table"><thead><tr>`;

             const discountPicking = 0.34; // 34%
             const discountPackageNormal = 0.37; // 37%
             const discountPackage38 = 0.38; // 38%

             if (isPackageTable) {
                 const discountUsed = use38PackageForThisPkg ? discountPackage38 : discountPackageNormal;
                 const discountPercent = Math.round(discountUsed * 100);
                 html += `<th>Paquete</th><th>Largo (mm)</th><th>m³</th><th>Precio Paquete (${discountPercent}%)</th>`;
             } else {
                 const discountPercent = Math.round(discountPicking * 100);
                  // Asumimos formato Picking: Almacen[0] ?? M3[2] ?? ?? Largo[ultima]
                 html += `<th>Almacén</th><th>Largo (mm)</th><th>m³</th><th>Precio Picking (${discountPercent}%)</th>`;
             }
             html += `</tr></thead><tbody>`;

             lines.forEach(line => {
                 const cols = line.split('\t').map(c => c.trim());
                 let largo = NaN, m3 = NaN, paqueteNum = '', almacen = 'N/A';

                 if (isPackageTable) {
                      // Formato Paquete: Alm[0] Paq[3] Largo[6] M3[9]
                     if (cols.length >= 10) {
                         almacen = cols[0] || 'N/A'; // Opcional mostrar almacén
                         paqueteNum = cols[3] || 'N/A';
                         largo = parseNumberES(cols[6]);
                         m3 = parseNumberES(cols[9]);
                     }
                 } else {
                      // Formato Picking: Alm[0] M3[2] Largo[ultima]
                     if (cols.length >= 3) {
                         almacen = cols[0] || 'N/A';
                         m3 = parseNumberES(cols[2]);
                         largo = parseNumberES(cols[cols.length - 1]); // Última columna
                     }
                 }

                 if (!isNaN(largo) && !isNaN(m3) && m3 > 0) {
                     const pricePerUnit = basePrice * m3; // Precio por el volumen de esta medida
                     let displayPrice = 0;
                      if (isPackageTable) {
                          const discount = use38PackageForThisPkg ? discountPackage38 : discountPackageNormal;
                          displayPrice = pricePerUnit * (1 - discount);
                          html += `<tr>
                                     <td>${paqueteNum}</td>
                                     <td>${formatNumberES_Length(largo)}</td>
                                     <td>${formatNumberES_M3(m3)}</td>
                                     <td>${formatNumberES_Price(displayPrice)}</td>
                                   </tr>`;
                      } else {
                          displayPrice = pricePerUnit * (1 - discountPicking);
                           html += `<tr>
                                     <td>${almacen}</td>
                                     <td>${formatNumberES_Length(largo)}</td>
                                     <td>${formatNumberES_M3(m3)}</td>
                                     <td>${formatNumberES_Price(displayPrice)}</td>
                                   </tr>`;
                      }
                 } else {
                      console.warn("Skipping Madera dimension line due to invalid data:", line);
                 }
             });

             html += `</tbody></table></div>`;
             return html;
        }


        function renderCards() {
            cardsContainer.innerHTML = ''; // Limpiar contenedor
            if (woodData.length === 0) {
                cardsContainer.innerHTML = "<p>No hay maderas añadidas.</p>";
                return;
            }

            woodData.forEach((pkg, index) => {
                const card = document.createElement('div');
                card.className = 'cardMadera';
                card.dataset.id = pkg.id; // Guardar ID por si se necesita

                // Botón Eliminar (usando addEventListener)
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn no-print';
                deleteBtn.innerHTML = '×'; // 'X' más elegante
                deleteBtn.title = 'Eliminar esta madera';
                deleteBtn.addEventListener('click', () => {
                    // Confirmación opcional
                    // if (confirm(`¿Seguro que quieres eliminar "${pkg.description}"?`)) {
                        woodData.splice(index, 1); // Eliminar por índice
                        renderCards(); // Re-renderizar
                        saveToLocalStorage(); // Guardar cambios
                    // }
                });

                // --- Construir HTML interno de la tarjeta ---
                const cardHeaderHTML = `
                  <div class="card-header">
                    <div class="company-text">Gabarró</div>
                    <div class="contact-info">
                      <strong>Marcos Sanchez</strong><br/>
                      Tel. 669 22 80 10<br/>
                      Email Consultas: marcos.sanchez@gabarro.com<br/>
                      Email Pedidos: ventas.galicia@gabarro.com
                    </div>
                  </div>`;

                const cardBody = document.createElement('div');
                cardBody.className = 'card-body';

                const title = document.createElement('h4');
                title.textContent = pkg.description;
                const basePriceInfo = document.createElement('p');
                basePriceInfo.innerHTML = `Precio Base: ${formatNumberES_Price(pkg.basePrice)} / m³`;

                cardBody.appendChild(title);
                cardBody.appendChild(basePriceInfo);

                // Generar tablas de dimensiones
                if (!pkg.onlyPackage && pkg.pickingDimensionsRaw) {
                    cardBody.innerHTML += generateDimensionTable('Picking', pkg.pickingDimensionsRaw, false, pkg.basePrice, pkg.use38Package);
                }
                if (pkg.packageDimensionsRaw) {
                    cardBody.innerHTML += generateDimensionTable('Paquete', pkg.packageDimensionsRaw, true, pkg.basePrice, pkg.use38Package);
                }

                // Ensamblar tarjeta
                card.appendChild(deleteBtn);
                card.innerHTML += cardHeaderHTML; // Añadir cabecera
                card.appendChild(cardBody); // Añadir cuerpo con tablas

                cardsContainer.appendChild(card);
            });
        }

        function clearInputs() {
            descriptionInput.value = '';
            priceInput.value = '';
            pickingTextarea.value = '';
            packageTextarea.value = '';
            onlyPackageChk.checked = false;
            use38PackageChk.checked = false; // Usar ID corregido
        }
        function clearAllInputsAndData() {
             if (confirm("¿Seguro que quieres borrar toda la configuración y las maderas añadidas?")) {
                 clearInputs();
                 woodData = []; // Vaciar array de datos
                 renderCards(); // Re-renderizar (mostrará mensaje vacío)
                 saveToLocalStorage(); // Guardar estado vacío
             }
        }


        function saveToLocalStorage() {
            try {
                localStorage.setItem('maderaPaquetesData_v2', JSON.stringify(woodData));
            } catch (e) {
                console.error("Error saving Madera data to localStorage:", e);
            }
        }

        function loadFromLocalStorage() {
            try {
                const savedData = localStorage.getItem('maderaPaquetesData_v2');
                if (savedData) {
                    woodData = JSON.parse(savedData);
                } else {
                    woodData = [];
                }
            } catch (e) {
                console.error("Error loading Madera data from localStorage:", e);
                woodData = [];
            }
            renderCards(); // Renderizar datos cargados (o vacío)
        }

        // Initial Load / Setup
        loadFromLocalStorage(); // Cargar datos guardados y renderizar

    })(); // End of Madera Paquetes App IIFE


    /********************* Aplicación Fabrica (IIFE) *********************/
    (function() {
        // DOM Elements (usando IDs únicos)
        const fabricaAppContainer = document.getElementById('fabricaApp');
        if (!fabricaAppContainer) return;

        const clientRadios = fabricaAppContainer.querySelectorAll('input[name="fabricaClientType"]');
        const clientInfoDiv = fabricaAppContainer.querySelector('#fabricaClientInfo');
        const quantityInput = fabricaAppContainer.querySelector('#fabricaQuantity');
        const descriptionInput = fabricaAppContainer.querySelector('#fabricaDescription');
        const dimensionsInput = fabricaAppContainer.querySelector('#fabricaDimensions');
        const pricePvpInput = fabricaAppContainer.querySelector('#fabricaPricePvp');
        const addRowBtn = fabricaAppContainer.querySelector('#fabricaAddRowBtn');
        const clearAllBtn = fabricaAppContainer.querySelector('#fabricaClearAllBtn'); // ID único
        const printBtn = fabricaAppContainer.querySelector('#fabricaPrintBtn'); // ID único
        const priceTableBody = fabricaAppContainer.querySelector('#fabricaPriceTable tbody'); // tbody
        const totalPriceCell = fabricaAppContainer.querySelector('#fabricaTotalPrice'); // tfoot cell

        // Early exit
        if (!clientRadios.length || !clientInfoDiv || !quantityInput || !descriptionInput || !dimensionsInput || !pricePvpInput || !addRowBtn || !clearAllBtn || !printBtn || !priceTableBody || !totalPriceCell) {
            console.error("Fabrica App: Missing essential HTML elements. Aborting initialization.");
            return;
        }

        // --- Descuentos Fabrica ---
        const discounts = {
            'B0': { low: { threshold: 250, discount: 0.28 }, high: { threshold: 1500, discount: 0.38 } },
            'A3': { low: { threshold: 250, discount: 0.31 }, high: { threshold: 1500, discount: 0.41 } },
            'M3': { low: { threshold: 250, discount: 0.34 }, high: { threshold: 1500, discount: 0.42 } }
        };

        // --- Event Listeners ---
        clientRadios.forEach(radio => {
            radio.addEventListener('change', updateClientInfoAndPrices); // Actualizar precios al cambiar cliente
        });

        addRowBtn.addEventListener('click', handleAddRow);

        clearAllBtn.addEventListener('click', () => {
             if (confirm("¿Seguro que quieres borrar todos los campos y la tabla de Fabrica?")) {
                 clearInputFields();
                 priceTableBody.innerHTML = ''; // Limpiar tabla
                 updateTotal(); // Reset total display
             }
        });

        printBtn.addEventListener('click', () => window.print());

        // --- Main Function to Add Row ---
        function handleAddRow() {
            // console.log("Fabrica Add Row clicked"); // Debug
            const quantity = parseInt(quantityInput.value) || 1;
            const description = descriptionInput.value.trim();
            const dimensions = dimensionsInput.value.trim();
            // Usar parseNumberES para manejar comas decimales
            const pricePvpPerSqm = parseNumberES(pricePvpInput.value); // PVP por m²

            if (!description || !dimensions || pricePvpPerSqm <= 0) {
                alert('Fabrica: Completa Cantidad, Descripción, Medidas (Ej: 2000x1000) y PVP (€/m²) válidos.');
                return;
            }

            let width = 0, height = 0, area = 0;
            // Regex mejorada para dimensiones, permite espacios y comas/puntos
            const dimensionParts = dimensions.match(/([\d.,]+)\s*[xX]\s*([\d.,]+)/);

            if (dimensionParts && dimensionParts.length === 3) {
                width = parseNumberES(dimensionParts[1]); // Usar parser ES
                height = parseNumberES(dimensionParts[2]); // Usar parser ES
                if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
                     area = (width * height) / 1000000; // area en m²
                } else {
                     alert('Fabrica: Dimensiones inválidas (ancho o alto). Usa números.'); return;
                }
            } else {
                alert('Fabrica: Formato de medidas incorrecto. Usa: anchura x altura (Ej: 2000x1000)'); return;
            }

            if (area <= 0) {
                 alert('Fabrica: El área calculada es 0 o negativa. Revisa las medidas.'); return;
            }

            // Crear nueva fila
            const newRow = priceTableBody.insertRow(); // Más eficiente
            newRow.dataset.originalPvpSqm = pricePvpPerSqm; // Guardar PVP/m² original
            newRow.dataset.area = area;
            newRow.dataset.quantity = quantity;

            // Crear celdas (mejor que innerHTML para seguridad y rendimiento)
            const cellQuantity = newRow.insertCell();
            const cellDescription = newRow.insertCell();
            const cellDimensions = newRow.insertCell();
            const cellNetSqm = newRow.insertCell();
            const cellNetBoard = newRow.insertCell();
            const cellTotalNet = newRow.insertCell();
            const cellAction = newRow.insertCell();

            cellQuantity.textContent = quantity;
            cellDescription.textContent = description;
            cellDescription.style.textAlign = 'left'; // Alinear descripción a la izquierda
            cellDimensions.textContent = dimensions;
            cellNetSqm.textContent = '-'; // Se calculará
            cellNetBoard.textContent = '-'; // Se calculará
            cellTotalNet.textContent = '-'; // Se calculará

            // Botón eliminar
            cellAction.classList.add('no-print');
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn'; // Estilo CSS específico
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Eliminar fila';
            removeBtn.addEventListener('click', function() {
                // priceTableBody.removeChild(newRow); // Funciona pero remove() es más directo
                newRow.remove();
                updateAllRowPrices(); // Recalcular total después de eliminar
            });
            cellAction.appendChild(removeBtn);

            // Recalcular todos los precios y el total DESPUÉS de añadir la fila al DOM
            updateAllRowPrices();

            // Limpiar campos para siguiente entrada (excepto cliente)
            clearInputFields(false); // No limpiar cliente
             descriptionInput.focus(); // Foco en descripción para siguiente item
        }


        // --- Helper Functions ---
        function parseNumberES(val) { // Duplicada de Madera, idealmente sería global/módulo
            if (!val || typeof val !== 'string') return 0;
            val = val.replace(/\s+/g, "");
            if (val.includes(",")) {
                val = val.replace(/\./g, "");
                val = val.replace(",", ".");
            }
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        }
         function formatPriceFabrica(value) {
             return `${value.toFixed(2)} €`; // Formato simple para Fabrica
         }


        function updateClientInfo() {
            let clientType = getSelectedClientType();
            const discountInfo = discounts[clientType];
            if (!discountInfo || !clientInfoDiv) return;

            clientInfoDiv.innerHTML = `
                <h3>Descuentos para cliente ${clientType}:</h3>
                <ul>
                    <li>Menos de ${formatPriceFabrica(discountInfo.low.threshold)}: 0% dto.</li>
                    <li>Desde ${formatPriceFabrica(discountInfo.low.threshold)} hasta ${formatPriceFabrica(discountInfo.high.threshold - 0.01)}: ${(discountInfo.low.discount * 100).toFixed(0)}% dto.</li>
                    <li>A partir de ${formatPriceFabrica(discountInfo.high.threshold)}: ${(discountInfo.high.discount * 100).toFixed(0)}% dto.</li>
                </ul>`;
        }

        function updateClientInfoAndPrices() {
            updateClientInfo();
            updateAllRowPrices(); // Recalcular precios cuando cambia el cliente
        }

        function updateAllRowPrices() {
            const rows = priceTableBody.querySelectorAll('tr');
            const currentTotalPVP = calculateCurrentTotalPVP(); // Calcular total PVP una vez

            rows.forEach(row => {
                const quantity = parseInt(row.dataset.quantity);
                const originalPvpSqm = parseFloat(row.dataset.originalPvpSqm);
                const area = parseFloat(row.dataset.area);

                if (isNaN(quantity) || isNaN(originalPvpSqm) || isNaN(area) || area <= 0) {
                    console.warn("Fabrica: Datos inválidos en fila para recalcular", row.dataset);
                    // Limpiar celdas si hay error
                    row.cells[3].textContent = 'Error';
                    row.cells[4].textContent = 'Error';
                    row.cells[5].textContent = 'Error';
                    return; // Saltar esta fila
                }

                // Calcular descuento basado en el total PVP del pedido
                const discount = getDiscount(currentTotalPVP);
                const newPriceNetPerSqm = originalPvpSqm * (1 - discount);
                const newPriceNetPerBoard = newPriceNetPerSqm * area;
                const newTotalNetForRow = newPriceNetPerBoard * quantity;

                // Actualizar celdas (índices 3, 4, 5)
                row.cells[3].textContent = `${newPriceNetPerSqm.toFixed(2)} €/m²`;
                row.cells[4].textContent = formatPriceFabrica(newPriceNetPerBoard);
                row.cells[5].textContent = formatPriceFabrica(newTotalNetForRow);
            });

            updateTotal(); // Actualizar total general neto en tfoot
        }

        function calculateCurrentTotalPVP() {
            let totalPVP = 0;
            const rows = priceTableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const quantity = parseInt(row.dataset.quantity);
                const originalPvpSqm = parseFloat(row.dataset.originalPvpSqm);
                const area = parseFloat(row.dataset.area);

                if (!isNaN(quantity) && !isNaN(originalPvpSqm) && !isNaN(area) && area > 0) {
                    totalPVP += originalPvpSqm * area * quantity; // PVP/m² * m² * cantidad
                }
            });
            // console.log("Calculated Total PVP:", totalPVP); // Debug
            return totalPVP;
        }

        function getSelectedClientType() {
            const selectedRadio = fabricaAppContainer.querySelector('input[name="fabricaClientType"]:checked');
            return selectedRadio ? selectedRadio.value : 'B0'; // Default a B0 si no hay ninguno
        }

        function getDiscount(currentTotalPvpValue) {
            let clientType = getSelectedClientType();
            const discountInfo = discounts[clientType];
            if (!discountInfo) return 0;

            // Aplicar descuentos según umbrales
            if (currentTotalPvpValue >= discountInfo.high.threshold) return discountInfo.high.discount;
            if (currentTotalPvpValue >= discountInfo.low.threshold) return discountInfo.low.discount;
            return 0; // Menos del umbral bajo
        }

        function updateTotal() {
            let totalNet = 0;
            const rows = priceTableBody.querySelectorAll('tr');
            rows.forEach(row => {
                // Extraer valor numérico de la celda "Total Neto" (índice 5)
                 const priceText = row.cells[5].textContent;
                 // Extraer solo el número, quitando '€' y espacios, y convirtiendo coma a punto si es necesario
                 const priceString = priceText.replace(/€/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                 const price = parseFloat(priceString);
                if (!isNaN(price)) {
                    totalNet += price;
                }
            });
            totalPriceCell.textContent = formatPriceFabrica(totalNet);
        }

        function clearInputFields(clearClient = true) {
            quantityInput.value = '1';
            descriptionInput.value = '';
            dimensionsInput.value = '';
            pricePvpInput.value = '';
             // Opcional: resetear cliente a B0
            if (clearClient && clientRadios.length > 0) {
                 fabricaAppContainer.querySelector('#fabricaClientB0').checked = true;
                 updateClientInfo(); // Actualizar info si se resetea cliente
            }
        }

        // Initialize client info and potentially load saved data on start
        updateClientInfo(); // Mostrar info inicial
        // Añadir loadFromLocalStorage() si se implementa persistencia para Fabrica

    })(); // End of Fabrica App IIFE

}); // End of DOMContentLoaded listener
