let inventoryData = [];
        let currentFilter = 'all';
        let searchQuery = '';
        let sortMode = 'default';
        let audioCtx = null;
        let lastScannedItem = null;
        let html5QrCode = null;
        let isCameraActive = false;
        let lastCameraScanTime = 0;
        let lastLoadedFileKey = '';
        let completionNotified = false;
        let toastTimer = null;
        let lastManualScanTime = 0; // защита от двойного Enter при ручном вводе

        const STORAGE_KEY = 'inventory_audit_state_v1';

        const barcodeInput = document.getElementById('barcodeInput');
        const excelFileInput = document.getElementById('excelFileInput');
        const itemsTableBody = document.getElementById('itemsTableBody');
        const exportBtn = document.getElementById('exportBtn');
        const resetBtn = document.getElementById('resetBtn');
        const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
        const filterBtns = document.querySelectorAll('.filter-btn');
        const lastScanContent = document.getElementById('lastScanContent');
        const lastScanBadge = document.getElementById('lastScanBadge');
        const lastScanCard = document.getElementById('lastScanCard');

        const totalItemsCount = document.getElementById('totalItemsCount');
        const totalPlanCount = document.getElementById('totalPlanCount');
        const totalFactCount = document.getElementById('totalFactCount');
        const completedItemsCount = document.getElementById('completedItemsCount');
        const filteredCountBadge = document.getElementById('filteredCountBadge');
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const focusIndicator = document.getElementById('focusIndicator');
        const saveStatus = document.getElementById('saveStatus');
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');
        const toast = document.getElementById('toast');
        const menuToggleBtn = document.getElementById('menuToggleBtn');
        barcodeInput.placeholder = 'Введите штрихкод или артикул и нажмите Enter...';

        menuToggleBtn.addEventListener('click', () => {
            const isOpen = menuToggleBtn.getAttribute('aria-expanded') === 'true';
            menuToggleBtn.setAttribute('aria-expanded', String(!isOpen));
            menuToggleBtn.setAttribute('aria-label', isOpen ? 'Открыть меню' : 'Закрыть меню');
            document.querySelector('.header-actions').classList.toggle('is-open', !isOpen);
        });

        const toggleCameraBtn = document.getElementById('toggleCameraBtn');
        const closeCameraBtn = document.getElementById('closeCameraBtn');
        const cameraContainer = document.getElementById('cameraContainer');
        const cameraBtnText = document.getElementById('cameraBtnText');
        const cameraScanStatus = document.getElementById('cameraScanStatus');

        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }

        function playSoundCountUp() {
            try {
                initAudio();
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);

                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start(now);
                osc.stop(now + 0.1);
            } catch (e) {}
        }

        function playSoundVictory() {
            try {
                initAudio();
                const now = audioCtx.currentTime;

                const osc1 = audioCtx.createOscillator();
                const gain1 = audioCtx.createGain();
                osc1.type = 'triangle';
                osc1.frequency.setValueAtTime(659.25, now);
                gain1.gain.setValueAtTime(0.3, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                osc1.connect(gain1);
                gain1.connect(audioCtx.destination);
                osc1.start(now);
                osc1.stop(now + 0.18);

                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(987.77, now + 0.12);
                gain2.gain.setValueAtTime(0.35, now + 0.12);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.start(now + 0.12);
                osc2.stop(now + 0.35);
            } catch (e) {}
        }

        function playSoundError() {
            try {
                initAudio();
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.setValueAtTime(110, now + 0.15);

                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start(now);
                osc.stop(now + 0.4);
            } catch (e) {}
        }

        barcodeInput.addEventListener('focus', () => {
            focusIndicator.textContent = 'Фокус активен';
            focusIndicator.className = 'text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold';
        });

        barcodeInput.addEventListener('blur', () => {
            focusIndicator.textContent = 'Готов к вводу';
            focusIndicator.className = 'text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold';
        });

        toggleCameraBtn.addEventListener('click', () => {
            if (isCameraActive) {
                stopCamera();
            } else {
                startCamera();
            }
        });

        closeCameraBtn.addEventListener('click', () => {
            stopCamera();
        });

        async function startCamera() {
            try {
                cameraContainer.classList.remove('hidden');
                cameraBtnText.textContent = 'Закрыть камеру';
                isCameraActive = true;

                if (!html5QrCode) {
                    html5QrCode = new Html5Qrcode("reader");
                }

                const config = { 
                    fps: 10, 
                    qrbox: { width: 250, height: 150 },
                    aspectRatio: 1.0
                };

                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    onScanSuccess,
                    onScanFailure
                );
            } catch (err) {
                console.error("Ошибка запуска камеры:", err);
                cameraScanStatus.textContent = "Не удалось открыть камеру. Проверьте разрешения.";
                cameraScanStatus.className = "text-center text-xs text-rose-400 mt-3 font-semibold";
            }
        }

        async function stopCamera() {
            if (html5QrCode && isCameraActive) {
                try {
                    await html5QrCode.stop();
                } catch (e) {
                    console.error("Ошибка остановки камеры", e);
                }
            }
            isCameraActive = false;
            cameraContainer.classList.add('hidden');
            cameraBtnText.textContent = 'Сканировать камерой';
        }

        function onScanSuccess(decodedText) {
            const now = Date.now();
            if (now - lastCameraScanTime < 1500) {
                return;
            }
            lastCameraScanTime = now;

            cameraScanStatus.textContent = `Отсканировано: ${decodedText}`;
            cameraScanStatus.className = "text-center text-xs text-emerald-400 mt-3 font-semibold";

            processBarcode(decodedText);

            setTimeout(() => {
                if (isCameraActive) {
                    cameraScanStatus.textContent = "Наведите камеру на следующий штрихкод";
                    cameraScanStatus.className = "text-center text-xs text-slate-400 mt-3";
                }
            }, 1200);
        }

        function onScanFailure(error) {
        }

        function normalizeHeader(value) {
            return String(value ?? '')
                .replace(/^\uFEFF/, '')
                .trim()
                .toLocaleLowerCase('ru-RU')
                .replace(/[«»"'`()\[\]{}:;,.\\/]+/g, '')
                .replace(/[\s_\-]+/g, '');
        }

        function getHeaderAliases(keys) {
            if (keys.includes('Barcode')) return ['barcode', '\u0448\u0442\u0440\u0438\u0445\u043a\u043e\u0434', '\u0448\u0442\u0440\u0438\u0445-\u043a\u043e\u0434', 'ean', 'ean13', '\u043a\u043e\u0434e\u0430\u043d'];
            if (keys.includes('SKU')) return ['sku', '\u0430\u0440\u0442\u0438\u043a\u0443\u043b', 'article', '\u043a\u043e\u0434', '\u043a\u043e\u0434\u0442\u043e\u0432\u0430\u0440\u0430', '\u043d\u043e\u043c\u0435\u0440\u043a\u043e\u0434\u0430'];
            if (keys.includes('Item')) return ['item', '\u043d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435', '\u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435', '\u043d\u043e\u043c\u0435\u043d\u043a\u043b\u0430\u0442\u0443\u0440\u0430', '\u0442\u043e\u0432\u0430\u0440', '\u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435'];
            if (keys.includes('Plan')) return ['plan', '\u043f\u043b\u0430\u043d', '\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e', '\u043a\u043e\u043b-\u0432\u043e', '\u043e\u0441\u0442\u0430\u0442\u043e\u043a', '\u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f', '\u0437\u0430\u043a\u0430\u0437\u0430\u043d\u043e'];
            if (keys.includes('Fact')) return ['fact', '\u0444\u0430\u043a\u0442', '\u043f\u043e\u0441\u0447\u0438\u0442\u0430\u043d\u043e', '\u043f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u043d\u043e'];
            return [];
        }

        function getItemStatus(item) {
            const plan = Number(item.plan) || 0;
            const fact = Number(item.fact) || 0;
            if (fact > plan) return 'surplus';
            if (fact === plan) return 'counted';
            if (fact > 0) return 'in-progress';
            return 'pending';
        }

        function normalizeBarcode(value) {
            const text = String(value ?? '').trim();
            if (!text) return '';
            if (/^[+-]?\d+(\.0+)?$/.test(text)) return text.replace(/\.0+$/, '');
            if (/^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(text)) {
                const expanded = Number(text).toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
                return expanded === 'NaN' ? text : expanded;
            }
            return text;
        }

        function parseQuantity(value, allowEmpty = false) {
            const text = String(value ?? '').trim();
            if (!text && allowEmpty) return 0;
            const compact = text.replace(/[ '\u00A0\u202F]/g, '');
            if (/^\d+$/.test(compact)) return Number(compact);

            const separators = [...compact.matchAll(/[.,]/g)].map(match => match.index);
            if (separators.length === 0) return null;

            const lastSeparator = separators[separators.length - 1];
            const fraction = compact.slice(lastSeparator + 1);
            const integerPart = compact.slice(0, lastSeparator).replace(/[.,]/g, '');
            if (!/^\d+$/.test(integerPart)) return null;

            if (separators.length === 1 && fraction.length === 3) return Number(compact.replace(/[.,]/g, ''));
            if (/^0+$/.test(fraction)) return Number(integerPart);
            return null;
        }

        function showToast(message, color = 'emerald') {
            if (!toast) return;
            toast.textContent = message;
            toast.className = `fixed top-4 right-4 z-50 max-w-sm translate-y-0 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg opacity-100 pointer-events-auto ${color === 'rose' ? 'bg-rose-600' : 'bg-emerald-600'}`;
            toast.style.opacity = '1';
            toast.style.pointerEvents = 'auto';
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.pointerEvents = 'none';
                toast.classList.remove('translate-y-0');
            }, 7000);
        }

        downloadTemplateBtn.addEventListener('click', () => {
            const sampleData = [
                { 'Штрихкод': '4601234567890', 'Артикул': 'ART-101', 'Наименование': 'Кофе арабика 250г', 'План': 10 },
                { 'Штрихкод': '4601234567891', 'Артикул': 'ART-102', 'Наименование': 'Чай черный 100г', 'План': 5 },
                { 'Штрихкод': '4601234567892', 'Артикул': 'ART-103', 'Наименование': 'Печенье овсяное 300г', 'План': 15 },
                { 'Штрихкод': '4601234567893', 'Артикул': 'ART-104', 'Наименование': 'Шоколад молочный 90г', 'План': 20 }
            ];

            const worksheet = XLSX.utils.json_to_sheet(sampleData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Ведомость");
            XLSX.writeFile(workbook, "Шаблон_Ревизии.xlsx");
        });

        excelFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
            if (fileKey === lastLoadedFileKey) {
                alert('Этот Excel-файл уже загружен. Выберите другой файл или измените его перед повторной загрузкой.');
                excelFileInput.value = '';
                return;
            }

            if (inventoryData.length > 0 && !confirm('Текущая ведомость будет заменена новой. Все текущие результаты ревизии будут потеряны. Продолжить?')) {
                excelFileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
                    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: true });

                    if (rows.length === 0) {
                        alert('Загруженный файл пуст');
                        excelFileInput.value = '';
                        return;
                    }

                    const hasHeader = (row, aliases) => {
                        const normalized = row.map(normalizeHeader);
                        return aliases.some(alias => normalized.includes(normalizeHeader(alias)));
                    };
                    const reportHeaderIndex = rows.findIndex(row =>
                        hasHeader(row, getHeaderAliases(['Item'])) &&
                        hasHeader(row, getHeaderAliases(['SKU'])) &&
                        hasHeader(row, getHeaderAliases(['Barcode']))
                    );
                    const reportQuantityIndex = reportHeaderIndex === -1
                        ? -1
                        : rows.findIndex((row, index) => index > reportHeaderIndex && hasHeader(row, ['Количество', 'Кол-во', 'Остаток']));
                    const isReinsReport = reportHeaderIndex !== -1 && reportQuantityIndex !== -1;
                    const headerIndex = isReinsReport ? reportHeaderIndex : rows.findIndex(row =>
                        (hasHeader(row, getHeaderAliases(['SKU'])) || hasHeader(row, getHeaderAliases(['Barcode']))) &&
                        hasHeader(row, getHeaderAliases(['Item'])) &&
                        hasHeader(row, getHeaderAliases(['Plan']))
                    );
                    if (headerIndex === -1) {
                        alert('Не удалось найти строку заголовков. Нужны колонки: Артикул, Наименование/Номенклатура и План/Остаток.');
                        excelFileInput.value = '';
                        return;
                    }

                    const dataStartIndex = isReinsReport ? reportQuantityIndex + 1 : headerIndex + 1;
                    const headerRow = rows[headerIndex].map((header, index) => String(header).trim() || `Column${index}`);
                    if (isReinsReport) {
                        const quantityColumnIndex = rows[reportQuantityIndex].findIndex(value => getHeaderAliases(['Plan']).some(alias => normalizeHeader(alias) === normalizeHeader(value)));
                        if (quantityColumnIndex !== -1) headerRow[quantityColumnIndex] = 'Количество';
                    }
                    const headers = headerRow.map(normalizeHeader);
                    const dataRows = rows.slice(dataStartIndex).map((row, index) => ({
                        formatted: Object.fromEntries(headerRow.map((header, columnIndex) => [header, row[columnIndex] ?? ''])),
                        raw: Object.fromEntries(headerRow.map((header, columnIndex) => [header, rawRows[dataStartIndex + index]?.[columnIndex] ?? '']))
                    })).filter(pair => Object.values(pair.formatted).some(value => String(value).trim() !== ''));
                    const rawJson = dataRows.map(pair => pair.formatted);
                    const rawValueJson = dataRows.map(pair => pair.raw);

                    const requiredColumns = [
                        { name: '\u0410\u0440\u0442\u0438\u043a\u0443\u043b', aliases: getHeaderAliases(['SKU']) },
                        { name: '\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435', aliases: getHeaderAliases(['Item']) },
                        { name: '\u041f\u043b\u0430\u043d', aliases: getHeaderAliases(['Plan']) }
                    ];
                    const missingColumns = requiredColumns
                        .filter(column => column.name !== '\u0410\u0440\u0442\u0438\u043a\u0443\u043b' || (!getHeaderAliases(['SKU']).some(alias => headers.includes(normalizeHeader(alias))) && !getHeaderAliases(['Barcode']).some(alias => headers.includes(normalizeHeader(alias)))))
                        .filter(column => !column.aliases.some(alias => headers.includes(normalizeHeader(alias))))
                        .map(column => column.name);
                    if (missingColumns.length > 0) {
                        alert(`Неверный Excel-файл. Не хватает колонок: ${missingColumns.join(", ")}. Используйте кнопку Шаблон.`);
                        excelFileInput.value = '';
                        return;
                    }

                    const parsedInventory = rawJson.map((row, index) => {
                        const rawRow = rawValueJson[index] || {};
                        const findValue = (keys) => {
                            for (let k of [...keys, ...getHeaderAliases(keys)]) {
                                const foundKey = Object.keys(row).find(rk => normalizeHeader(rk) === normalizeHeader(k));
                                if (foundKey !== undefined) return row[foundKey];
                            }
                            return '';
                        };
                        const findRawValue = (keys) => {
                            for (let k of [...keys, ...getHeaderAliases(keys)]) {
                                const foundKey = Object.keys(rawRow).find(rk => normalizeHeader(rk) === normalizeHeader(k));
                                if (foundKey !== undefined) return rawRow[foundKey];
                            }
                            return '';
                        };

                        const rowNumber = dataStartIndex + index + 1;
                        const barcode = normalizeBarcode(findValue(['Штрихкод', 'Штрих-код', 'Barcode']));
                        const sku = String(findValue(['Артикул', 'SKU', 'Код'])).trim();
                        const name = String(findValue(['Наименование', 'Название', 'Номенклатура', 'Item'])).trim();
                        const planRaw = findValue(['План', 'Количество', 'Кол-во', 'Plan']);
                        const factRaw = findValue(['Факт', 'Fact']);
                        const rawPlanValue = findRawValue(['Plan']);
                        const rawFactValue = findRawValue(['Fact']);
                        const plan = typeof rawPlanValue === 'number' ? rawPlanValue : parseQuantity(planRaw);
                        const fact = typeof rawFactValue === 'number' ? rawFactValue : parseQuantity(factRaw, true);
                        if (!name && !sku && !barcode && plan === 0 && fact === 0) return null;
                        if (!Number.isInteger(plan) || plan < 0) throw new Error(`\u0421\u0442\u0440\u043e\u043a\u0430 ${rowNumber}: \u043f\u043b\u0430\u043d \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u0446\u0435\u043b\u044b\u043c \u0447\u0438\u0441\u043b\u043e\u043c \u043d\u0435 \u043c\u0435\u043d\u044c\u0448\u0435 \u043d\u0443\u043b\u044f.`);

                        if (!sku && !barcode) throw new Error(`\u0421\u0442\u0440\u043e\u043a\u0430 ${rowNumber}: \u043d\u0443\u0436\u0435\u043d \u0430\u0440\u0442\u0438\u043a\u0443\u043b \u0438\u043b\u0438 \u0448\u0442\u0440\u0438\u0445\u043a\u043e\u0434.`);
                        if (!name) throw new Error(`Строка ${rowNumber}: пустое наименование.`);
                        if (plan === null) throw new Error(`Строка ${rowNumber}: план должен быть целым числом не меньше нуля.`);
                        if (fact === null) throw new Error(`Строка ${rowNumber}: факт должен быть целым числом не меньше нуля.`);

                        return {
                            id: index + 1,
                            barcode: barcode,
                            sku: sku || '-',
                            name: name,
                            plan: plan,
                            fact: fact
                        };
                    }).filter(Boolean);

                    const barcodeOwners = new Map();
                    const duplicateBarcodes = [];
                    parsedInventory.forEach(item => {
                        if (!item.barcode) return;
                        const key = item.barcode.toLocaleLowerCase('ru-RU');
                        if (barcodeOwners.has(key)) duplicateBarcodes.push(item.barcode);
                        barcodeOwners.set(key, item.id);
                    });
                    if (duplicateBarcodes.length > 0) {
                        alert(`Excel-файл отклонен: повторяются штрихкоды: ${[...new Set(duplicateBarcodes)].join(", ")}`);
                        excelFileInput.value = '';
                        return;
                    }

                    inventoryData = parsedInventory;
                    lastLoadedFileKey = fileKey;
                    completionNotified = false;
                    lastScannedItem = null;
                    renderLastScanned();
                    renderTable();
                    updateSummary();
                    saveState();
                    excelFileInput.value = '';

                } catch (err) {
                    console.error(err);
                    alert(err instanceof Error ? err.message : 'Не удалось прочитать Excel-файл. Проверьте его структуру.');
                }
            };
            reader.readAsArrayBuffer(file);
        });

        barcodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const now = Date.now();
                if (now - lastManualScanTime < 300) return; // игнорируем слишком быстрые повторы
                lastManualScanTime = now;

                const code = barcodeInput.value.trim();
                barcodeInput.value = '';

                if (!code) return;

                processBarcode(code);
            }
        });

        function processBarcode(code) {
            if (inventoryData.length === 0) {
                playSoundError();
                showErrorScan(code, 'Ведомость товаров не загружена!');
                return;
            }

            code = normalizeBarcode(code);
            const searchValue = code.toLocaleLowerCase('ru-RU');
            const itemIndex = inventoryData.findIndex(item => {
                const barcode = normalizeBarcode(item.barcode).toLocaleLowerCase('ru-RU');
                const sku = String(item.sku ?? '').trim().toLocaleLowerCase('ru-RU');
                return barcode === searchValue || sku === searchValue;
            });

            if (itemIndex !== -1) {
                const item = inventoryData[itemIndex];
                item.fact = (Number(item.fact) || 0) + 1;

                lastScannedItem = {
                    ...item,
                    isError: false,
                    message: item.fact > item.plan ? 'Перевыполнение (Излишек)' : 'Успешно посчитано'
                };

                if (item.fact === item.plan) {
                    playSoundVictory();
                    triggerCardAnimation('green');
                } else {
                    playSoundCountUp();
                    triggerCardAnimation('green');
                }

                renderLastScanned();
                renderTable();
                updateSummary();
                saveState();

            } else {
                playSoundError();
                triggerCardAnimation('red');
                showErrorScan(code, 'Товар НЕ НАЙДЕН в ведомости (Пересортица)');
            }
        }

        function triggerCardAnimation(color) {
            lastScanCard.classList.remove('animate-pulse-green', 'animate-pulse-red');
            void lastScanCard.offsetWidth;
            if (color === 'green') {
                lastScanCard.classList.add('animate-pulse-green');
            } else {
                lastScanCard.classList.add('animate-pulse-red');
            }
        }

        function showErrorScan(code, errorMsg) {
            lastScanBadge.classList.remove('hidden');
            lastScanBadge.textContent = 'ОШИБКА';
            lastScanBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700';

            lastScanContent.innerHTML = `
                <div class="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 text-rose-900">
                    <div class="text-xs uppercase font-bold text-rose-500 mb-1">Неизвестный штрихкод</div>
                    <div class="text-sm font-semibold flex items-center gap-2 text-rose-700">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        ${escapeHtml(errorMsg)}
                    </div>
                </div>
            `;
        }

        function renderLastScanned() {
            if (!lastScannedItem) {
                lastScanBadge.classList.add('hidden');
                lastScanContent.innerHTML = `
                    <div class="text-slate-400 text-center py-8">
                        Отсканируйте товар для отображения информации
                    </div>
                `;
                return;
            }

            const item = lastScannedItem;
            const isCompleted = item.fact >= item.plan;

            lastScanBadge.classList.remove('hidden');
            if (item.fact > item.plan) {
                lastScanBadge.textContent = 'Излишек';
                lastScanBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800';
            } else if (isCompleted) {
                lastScanBadge.textContent = 'Посчитано ✓';
                lastScanBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800';
            } else {
                lastScanBadge.textContent = 'В процессе';
                lastScanBadge.className = 'text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800';
            }

            lastScanContent.innerHTML = `
                <div class="grid gap-4 md:grid-cols-[1fr_280px] md:items-start">
                    <div class="order-2 md:order-1">
                        <h3 class="text-xl md:text-2xl font-bold text-slate-900 leading-snug mb-2">${escapeHtml(item.name)}</h3>
                        <div class="flex flex-wrap gap-4 text-sm text-slate-500 font-mono">
                            <span>Артикул: <strong class="text-slate-800">${escapeHtml(item.sku)}</strong></span>
                            <span>Штрихкод: <strong class="text-slate-800">${escapeHtml(item.barcode)}</strong></span>
                        </div>
                    </div>

                    <div class="order-1 md:order-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
                            <div class="text-center sm:text-left md:text-center md:border-b md:border-slate-200 md:pb-4">
                                <span class="text-xs text-slate-400 uppercase font-bold">План</span>
                                <div class="text-3xl font-black text-slate-700 mt-1">${item.plan}</div>
                            </div>
                            <div class="text-center sm:text-left md:text-center">
                                <span class="text-xs text-slate-400 uppercase font-bold">Факт</span>
                                <div class="flex items-center justify-center gap-3 mt-2">
                                    <button id="decrementBtn" type="button" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1 rounded-lg font-bold text-lg">−</button>
                                    <input id="factValue" type="number" min="0" step="1" inputmode="numeric" value="${item.fact}" aria-label="Фактическое количество" class="w-20 bg-white/70 text-center text-3xl font-black ${isCompleted ? 'text-emerald-600' : 'text-indigo-600'} focus:outline-none focus:ring-2 focus:ring-indigo-300 rounded-lg">
                                    <button id="incrementBtn" type="button" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1 rounded-lg font-bold text-lg">+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const inc = document.getElementById('incrementBtn');
            const dec = document.getElementById('decrementBtn');
            const factInput = document.getElementById('factValue');
            if (inc) inc.addEventListener('click', () => { incrementLast(); });
            if (dec) dec.addEventListener('click', () => { decrementLast(); });
            if (factInput) {
                factInput.addEventListener('change', () => setFact(item.id, factInput.value));
                factInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') factInput.blur();
                });
            }
        }

        // Изменить значение fact для товара с указанным id
        function setFact(itemId, value) {
            const idx = inventoryData.findIndex(i => i.id === itemId);
            if (idx === -1) return;
            const item = inventoryData[idx];
            const previousFact = parseInt(item.fact, 10) || 0;
            let newFact = parseInt(value, 10);
            if (Number.isNaN(newFact)) newFact = previousFact;
            if (newFact < 0) newFact = 0;
            item.fact = newFact;

            lastScannedItem = {
                ...item,
                isError: false,
                message: item.fact > item.plan ? 'Перевыполнение (Излишек)' : 'Успешно посчитано'
            };

            if (newFact > previousFact) {
                playSoundCountUp();
                triggerCardAnimation('green');
            } else if (newFact < previousFact) {
                playSoundError();
                triggerCardAnimation('red');
            }

            renderLastScanned();
            renderTable();
            updateSummary();
            saveState();
        }

        function adjustFact(itemId, delta) {
            const item = inventoryData.find(i => i.id === itemId);
            if (!item) return;
            setFact(itemId, (parseInt(item.fact, 10) || 0) + delta);
        }

        function incrementLast() {
            if (!lastScannedItem) return;
            adjustFact(lastScannedItem.id, 1);
        }

        function decrementLast() {
            if (!lastScannedItem) return;
            adjustFact(lastScannedItem.id, -1);
        }

        function renderTable() {
            if (inventoryData.length === 0) {
                itemsTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-12 text-slate-400">
                            Загрузите Excel файл с ведомостью для начала работы
                        </td>
                    </tr>
                `;
                filteredCountBadge.textContent = '0';
                exportBtn.disabled = true;
                return;
            }

            exportBtn.disabled = false;

            const query = searchQuery.trim().toLocaleLowerCase('ru-RU');
            const filtered = inventoryData.filter(item => {
                return currentFilter === 'all' || getItemStatus(item) === currentFilter;
            }).filter(item => {
                if (!query) return true;
                return [item.name, item.sku, item.barcode]
                    .some(value => String(value).toLocaleLowerCase('ru-RU').includes(query));
            });

            const collator = new Intl.Collator('ru-RU', { sensitivity: 'base', numeric: true });
            filtered.sort((a, b) => {
                switch (sortMode) {
                    case 'name-asc': return collator.compare(a.name, b.name);
                    case 'sku-asc': return collator.compare(a.sku, b.sku);
                    case 'plan-desc': return b.plan - a.plan;
                    case 'fact-desc': return b.fact - a.fact;
                    case 'status': return (a.fact >= a.plan) - (b.fact >= b.plan);
                    default: return a.id - b.id;
                }
            });

            filteredCountBadge.textContent = filtered.length;

            if (filtered.length === 0) {
                itemsTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-8 text-slate-400">
                            Нет товаров, соответствующих выбранному фильтру
                        </td>
                    </tr>
                `;
                return;
            }

            itemsTableBody.innerHTML = filtered.map(item => {
                const status = getItemStatus(item);
                const isCompleted = status === 'counted';
                const isOver = status === 'surplus';
                const isLastScanned = lastScannedItem && lastScannedItem.id === item.id;

                let rowClass = "hover:bg-slate-50 transition-colors";
                if (isCompleted) {
                    rowClass = "bg-emerald-50/70 hover:bg-emerald-100/60 text-emerald-950";
                }
                if (isOver) {
                    rowClass = "bg-amber-50/70 hover:bg-amber-100/60 text-amber-950";
                }
                if (isLastScanned) {
                    rowClass += " ring-2 ring-indigo-400 ring-inset";
                }

                return `
                    <tr id="row-${item.id}" class="${rowClass}">
                        <td class="py-3 px-4 text-center font-bold">
                            ${isOver ? `<span class="inline-flex items-center justify-center w-6 h-6 bg-amber-500 text-white rounded-full text-xs" title="Излишек">+</span>` : isCompleted ? `<span class="inline-flex items-center justify-center w-6 h-6 bg-emerald-500 text-white rounded-full text-xs" title="Посчитано">✓</span>` : status === 'in-progress' ? `<span class="inline-flex items-center justify-center w-6 h-6 bg-indigo-500 text-white rounded-full text-xs" title="В процессе">…</span>` : `<span class="text-slate-300">•</span>`}
                        </td>
                        <td class="py-3 px-4 font-mono text-xs text-slate-600 font-semibold">${item.barcode ? escapeHtml(item.barcode) : '<span class="text-slate-400 italic">Нет штрихкода</span>'}</td>
                        <td class="py-3 px-4 font-mono text-xs text-slate-600">${escapeHtml(item.sku)}</td>
                        <td class="py-3 px-4 font-medium text-slate-800">${escapeHtml(item.name)}</td>
                        <td class="py-3 px-4 text-center font-bold text-slate-600">${item.plan}</td>
                        <td class="py-3 px-4 text-center">
                            <input type="number" min="0" step="1" inputmode="numeric" value="${item.fact}" data-item-id="${item.id}" aria-label="Фактическое количество" class="fact-table-input w-20 max-w-full rounded-lg border border-transparent bg-slate-100 px-2 py-1 text-center font-bold ${isOver ? 'text-amber-900' : isCompleted ? 'text-emerald-900' : 'text-slate-800'} focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function updateSummary() {
            const totalItems = inventoryData.length;
            const totalPlan = inventoryData.reduce((acc, curr) => acc + (Number(curr.plan) || 0), 0);
            const totalFact = inventoryData.reduce((acc, curr) => acc + (Number(curr.fact) || 0), 0);
            const countedUnits = inventoryData.reduce((acc, curr) => {
                const plan = Number(curr.plan) || 0;
                const fact = Number(curr.fact) || 0;
                return acc + Math.min(fact, plan);
            }, 0);
            const completedItems = inventoryData.filter(item => Number(item.fact) >= Number(item.plan)).length;
            const isComplete = totalPlan > 0 && inventoryData.length > 0 && inventoryData.every(item => Number(item.fact) >= Number(item.plan));

            if (isComplete && !completionNotified) {
                showToast('Ревизия завершена. Все товары посчитаны!');
                completionNotified = true;
            } else if (!isComplete) {
                completionNotified = false;
            }

            totalItemsCount.textContent = totalItems;
            totalPlanCount.textContent = totalPlan;
            totalFactCount.textContent = totalFact;
            completedItemsCount.textContent = completedItems;

            const percent = totalPlan > 0 ? Math.round((countedUnits / totalPlan) * 100) : 0;
            progressBar.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}%`;
        }

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => {
                    b.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
                    b.classList.add('text-slate-600');
                });
                btn.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
                btn.classList.remove('text-slate-600');

                currentFilter = btn.getAttribute('data-filter');
                renderTable();
            });
        });

        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            renderTable();
        });

        sortSelect.addEventListener('change', () => {
            sortMode = sortSelect.value;
            renderTable();
        });

        itemsTableBody.addEventListener('change', (event) => {
            const input = event.target.closest('.fact-table-input');
            if (!input) return;
            setFact(Number(input.dataset.itemId), input.value);
        });

        itemsTableBody.addEventListener('keydown', (event) => {
            const input = event.target.closest('.fact-table-input');
            if (input && event.key === 'Enter') input.blur();
        });

        exportBtn.addEventListener('click', () => {
            if (inventoryData.length === 0) return;

            const exportRows = inventoryData.map(item => {
                let status = 'Совпало';
                if (item.fact < item.plan) status = 'Нехватка';
                if (item.fact > item.plan) status = 'Излишек';

                return {
                    'Штрихкод': item.barcode,
                    'Артикул': item.sku,
                    'Наименование': item.name,
                    'План': item.plan,
                    'Факт': item.fact,
                    'Статус': status
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(exportRows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Результат ревизии");

            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(workbook, `Ревизия_Результат_${dateStr}.xlsx`);
        });

        resetBtn.addEventListener('click', () => {
            if (inventoryData.length === 0) return;

            const resetPhrase = prompt('Для полного сброса введите слово СБРОС.');
            if (resetPhrase !== 'СБРОС') {
                showToast('Сброс отменен. Данные сохранены.', 'rose');
                return;
            }

            if (confirm('Вы действительно хотите сбросить текущие данные ревизии? Все несохраненные в Excel изменения будут удалены.')) {
                inventoryData = [];
                lastScannedItem = null;
                lastLoadedFileKey = '';
                completionNotified = false;
                searchQuery = '';
                searchInput.value = '';
                localStorage.removeItem(STORAGE_KEY);
                renderLastScanned();
                renderTable();
                updateSummary();
                saveStatus.textContent = 'Данные сброшены';
            }
        });

        function saveState() {
            try {
                const state = {
                    inventoryData,
                    lastScannedItem
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                saveStatus.textContent = `Сохранено (${new Date().toLocaleTimeString().slice(0, 5)})`;
            } catch (e) {
                console.error('Ошибка сохранения в localStorage', e);
            }
        }

        function loadState() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const state = JSON.parse(saved);
                    inventoryData = state.inventoryData || [];
                    lastScannedItem = state.lastScannedItem || null;

                    renderLastScanned();
                    renderTable();
                    updateSummary();
                    saveStatus.textContent = 'Данные восстановлены';
                }
            } catch (e) {
                console.error('Ошибка загрузки из localStorage', e);
            }
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        window.addEventListener('beforeunload', (event) => {
            const totalPlan = inventoryData.reduce((sum, item) => sum + (Number(item.plan) || 0), 0);
            const isComplete = totalPlan > 0 && inventoryData.length > 0 && inventoryData.every(item => Number(item.fact) >= Number(item.plan));
            if (inventoryData.length > 0 && !isComplete) {
                event.preventDefault();
                event.returnValue = 'Ревизия не завершена. Вы уверены, что хотите покинуть страницу?';
            }
        });

        window.addEventListener('DOMContentLoaded', () => {
            loadState();
        });
