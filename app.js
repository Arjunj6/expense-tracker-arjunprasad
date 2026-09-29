/* ============================================================
   Expense Tracker — app.js
   Data, UI, LocalStorage, Filters, CRUD
   ============================================================ */

   'use strict';

   /* ── Constants ── */
   const STORAGE_KEY = 'expenseTrackerData_v3';
   
   const CATEGORIES = {
     expense: [
       { value: 'food',          label: 'Food & Dining'    },
       { value: 'transport',     label: 'Transport'        },
       { value: 'housing',       label: 'Housing & Rent'   },
       { value: 'utilities',     label: 'Utilities'        },
       { value: 'entertainment', label: 'Entertainment'    },
       { value: 'health',        label: 'Health & Medical'  },
       { value: 'shopping',      label: 'Shopping'         },
       { value: 'education',     label: 'Education'        },
       { value: 'travel',        label: 'Travel'           },
       { value: 'other_expense', label: 'Other'            },
     ],
     income: [
       { value: 'salary',        label: 'Salary'           },
       { value: 'freelance',     label: 'Freelance'        },
       { value: 'investment',    label: 'Investment'       },
       { value: 'gift',          label: 'Gift'             },
       { value: 'other_income',  label: 'Other Income'     },
     ],
   };
   
   /* ── State ── */
   let transactions    = [];
   let activeType      = 'all';
   let activeCategory  = 'all';
   let searchQuery     = '';
   let deleteTargetId  = null;
   let currentFormType = 'expense';
   
   /* ── DOM References ── */
   const $ = id => document.getElementById(id);
   
   const els = {
     balance:         $('balance'),
     totalIncome:     $('totalIncome'),
     totalExpenses:   $('totalExpenses'),
     transactionList: $('transactionList'),
     emptyState:      $('emptyState'),
     txCount:         $('txCount'),
     categoryFilter:  $('categoryFilter'),
     searchInput:     $('searchInput'),
     typeFilter:      $('typeFilter'),
     monthSelect:     $('monthSelect'),
     monthIncome:     $('monthIncome'),
     monthExpense:    $('monthExpense'),
     monthNet:        $('monthNet'),
     monthCompare:    $('monthCompare'),
     categoryChart:   $('categoryChart'),
   
     modalOverlay:    $('modalOverlay'),
     modalTitle:      $('modalTitle'),
     transactionForm: $('transactionForm'),
     editId:          $('editId'),
     typeToggle:      $('typeToggle'),
     amount:          $('amount'),
     date:            $('date'),
     category:        $('category'),
     description:     $('description'),
     submitBtn:       $('submitBtn'),
   
     deleteOverlay:   $('deleteOverlay'),
     toast:           $('toast'),
   };
   
   /* ── LocalStorage ── */
   function saveToStorage() {
     localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
   }
   
   function loadFromStorage() {
     try {
       const raw = localStorage.getItem(STORAGE_KEY);
       transactions = raw ? JSON.parse(raw) : [];
     } catch {
       transactions = [];
     }
   }
   
   /* ── Utilities ── */
   function generateId() {
     return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
   }
   
   function formatCurrency(amount) {
     return new Intl.NumberFormat('en-IN', {
       style: 'currency', currency: 'INR', minimumFractionDigits: 2,
     }).format(amount);
   }
   
   function formatDate(dateStr) {
     if (!dateStr) return '';
     const [y, m, d] = dateStr.split('-');
     return new Date(+y, +m - 1, +d).toLocaleDateString('en-US', {
       month: 'short', day: 'numeric', year: 'numeric',
     });
   }
   
   function getTodayStr() {
     const d = new Date();
     return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
   }
   
   function getCategoryLabel(value, type) {
     const list = CATEGORIES[type] || [...CATEGORIES.expense, ...CATEGORIES.income];
     const found = list.find(c => c.value === value);
     return found ? found.label : value;
   }
   
   function escHtml(str) {
     return str.replace(/[&<>"']/g, c => ({
       '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
     }[c]));
   }
   
   /* ── Toast ── */
   let toastTimer = null;
   
   function showToast(message, type = 'success') {
     els.toast.textContent = message;
     els.toast.className = `toast show ${type}`;
     if (toastTimer) clearTimeout(toastTimer);
     toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3000);
   }
   
   /* ── Totals ── */
   function getTotals(list = transactions) {
     const income   = list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
     const expenses = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
     return { income, expenses, balance: income - expenses };
   }
   
   /* ── Summary Render ── */
   function renderSummary() {
     const { income, expenses, balance } = getTotals();
     els.totalIncome.textContent   = formatCurrency(income);
     els.totalExpenses.textContent = formatCurrency(expenses);
     els.balance.textContent       = formatCurrency(Math.max(0, balance));
   }
   
   /* ── Category Filter Builder ── */
   function buildCategoryFilterOptions() {
     const usedCats = [...new Set(transactions.map(t => t.category))];
     const allCats  = [...CATEGORIES.expense, ...CATEGORIES.income];
     const labelMap = Object.fromEntries(allCats.map(c => [c.value, c.label]));
     const sel      = els.categoryFilter;
     const prev     = sel.value;
   
     sel.innerHTML = '<option value="all">All Categories</option>';
     usedCats.forEach(cat => {
       const opt = document.createElement('option');
       opt.value = cat;
       opt.textContent = labelMap[cat] || cat;
       sel.appendChild(opt);
     });
   
     sel.value      = usedCats.includes(prev) ? prev : 'all';
     activeCategory = sel.value;
   }
   
   /* ── Filtered Transactions ── */
   function getFilteredTransactions() {
     return transactions
       .filter(t => {
         const matchType     = activeType === 'all' || t.type === activeType;
         const matchCategory = activeCategory === 'all' || t.category === activeCategory;
         const q             = searchQuery.toLowerCase();
         const matchSearch   = q === '' ||
           (t.description || '').toLowerCase().includes(q) ||
           getCategoryLabel(t.category, t.type).toLowerCase().includes(q);
         return matchType && matchCategory && matchSearch;
       })
       .sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
   }
   
   /* ── Render Transactions ── */
   function renderTransactions() {
     const filtered = getFilteredTransactions();
     const list = els.transactionList;
   
     [...list.querySelectorAll('.tx-item')].forEach(el => el.remove());
   
     els.txCount.textContent = `${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`;
   
     if (filtered.length === 0) {
       els.emptyState.style.display = 'flex';
       return;
     }
   
     els.emptyState.style.display = 'none';
   
     filtered.forEach(t => {
       const label = getCategoryLabel(t.category, t.type);
       const sign  = t.type === 'income' ? '+' : '−';
   
       const item = document.createElement('div');
       item.className = 'tx-item';
       item.dataset.id = t.id;
   
       item.innerHTML = `
         <div class="tx-main">
           <div class="tx-desc">${escHtml(t.description || label)}</div>
           <div class="tx-meta">
             <span class="tx-badge ${t.type}">${t.type}</span>
             <span class="tx-date">${formatDate(t.date)}</span>
             <span class="tx-date">· ${label}</span>
           </div>
         </div>
         <div class="tx-right">
           <span class="tx-amount ${t.type}">${sign}${formatCurrency(t.amount)}</span>
           <div class="tx-actions">
             <button class="action-btn edit-btn">Edit</button>
             <button class="action-btn danger delete-btn">Delete</button>
           </div>
         </div>
       `;
   
       item.querySelector('.edit-btn').addEventListener('click', () => openEditModal(t.id));
       item.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(t.id));
       list.appendChild(item);
     });
   }

    /* ── Monthly Summary & Category Chart ── */
      let selectedMonth = null;
      const CHART_COLORS = ['#7c6dff', '#ff4d6d', '#22d05e', '#ffb02e', '#2ec5ff', '#e05cff', '#ff7a45', '#5ce0b8', '#a0a6c4', '#c9d84a'];
   
      const monthKey = dateStr => dateStr.slice(0, 7);
   
      function monthLabel(key) {
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
   
      function prevMonthKey(key) {
        const [y, m] = key.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
   
      function buildMonthOptions() {
        const current = monthKey(getTodayStr());
        const keys = [...new Set(transactions.map(t => monthKey(t.date)))];
        if (!keys.includes(current)) keys.push(current);
        keys.sort().reverse();
   
        els.monthSelect.innerHTML = keys
          .map(k => `<option value="${k}">${monthLabel(k)}</option>`).join('');
        if (!keys.includes(selectedMonth)) selectedMonth = current;
        els.monthSelect.value = selectedMonth;
      }
   
      function renderMonthly() {
        const list = transactions.filter(t => monthKey(t.date) === selectedMonth);
        const { income, expenses } = getTotals(list);
        const net = income - expenses;
   
        els.monthIncome.textContent  = formatCurrency(income);
        els.monthExpense.textContent = formatCurrency(expenses);
        els.monthNet.textContent     = formatCurrency(net);
        els.monthNet.className       = `stat-value ${net < 0 ? 'expense' : 'income'}`;
   
        const prevKey = prevMonthKey(selectedMonth);
        const prevExp = getTotals(transactions.filter(t => monthKey(t.date) === prevKey)).expenses;
        if (expenses === 0 && prevExp === 0) {
          els.monthCompare.innerHTML = '';
        } else if (prevExp === 0) {
          els.monthCompare.textContent = `No expenses in ${monthLabel(prevKey)} to compare with.`;
        } else {
          const pct = Math.round(Math.abs(expenses - prevExp) / prevExp * 100);
          if (pct === 0) {
            els.monthCompare.textContent = `Spending is the same as ${monthLabel(prevKey)}.`;
          } else {
            const more = expenses > prevExp;
            els.monthCompare.innerHTML =
              `<span class="${more ? 'up' : 'down'}">${more ? '▲' : '▼'} ${pct}% ${more ? 'more' : 'less'}</span> spending than ${monthLabel(prevKey)}`;
          }
        }
   
        const byCat = {};
        list.filter(t => t.type === 'expense').forEach(t => {
          byCat[t.category] = (byCat[t.category] || 0) + t.amount;
        });
        const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
   
        if (rows.length === 0) {
          els.categoryChart.innerHTML = `<p class="chart-empty">No expenses recorded for ${monthLabel(selectedMonth)}.</p>`;
          return;
        }
        els.categoryChart.innerHTML = rows.map(([cat, amt], i) => {
          const pct = Math.round(amt / expenses * 100);
          return `<div class="chart-row">
            <span class="chart-label">${escHtml(getCategoryLabel(cat, 'expense'))}</span>
            <div class="chart-track"><div class="chart-fill" style="width:${Math.max(pct, 2)}%;background:${CHART_COLORS[i % CHART_COLORS.length]}"></div></div>
            <span class="chart-value">${formatCurrency(amt)} · ${pct}%</span>
          </div>`;
        }).join('');
      }
   /* ── Full Refresh ── */
   function refresh() {
     renderSummary();
     buildCategoryFilterOptions();
     buildMonthOptions();
     renderMonthly();
     renderTransactions();

   }
   
   /* ── Modal: Category Options ── */
   function populateCategoryOptions(type) {
     const sel = els.category;
     sel.innerHTML = '';
     CATEGORIES[type].forEach(c => {
       const opt = document.createElement('option');
       opt.value = c.value;
       opt.textContent = c.label;
       sel.appendChild(opt);
     });
   }
   
   /* ── Modal: Open / Close ── */
   function openAddModal() {
     currentFormType = 'expense';
     els.editId.value = '';
     els.modalTitle.textContent = 'Add Transaction';
     els.submitBtn.textContent  = 'Add Transaction';
     els.transactionForm.reset();
     els.date.value = getTodayStr();
   
     setFormType('expense');
     clearFormErrors();
     els.modalOverlay.classList.add('open');
     setTimeout(() => els.amount.focus(), 50);
   }
   
   function openEditModal(id) {
     const t = transactions.find(tx => tx.id === id);
     if (!t) return;
   
     currentFormType = t.type;
     els.editId.value           = t.id;
     els.modalTitle.textContent = 'Edit Transaction';
     els.submitBtn.textContent  = 'Save Changes';
     els.amount.value           = t.amount;
     els.date.value             = t.date;
     els.description.value      = t.description || '';
   
     setFormType(t.type);
     populateCategoryOptions(t.type);
     els.category.value = t.category;
   
     clearFormErrors();
     els.modalOverlay.classList.add('open');
     setTimeout(() => els.amount.focus(), 50);
   }
   
   function closeModal() {
     els.modalOverlay.classList.remove('open');
   }
   
   function setFormType(type) {
     currentFormType = type;
     [...els.typeToggle.querySelectorAll('.type-btn')].forEach(btn => {
       btn.classList.toggle('active', btn.dataset.type === type);
     });
     populateCategoryOptions(type);
     clearFormErrors();
   }
      /* ── Chronological balance check ── */
   // Returns the first date where the running balance drops below ₹0, or null.
   function firstNegativeDate(list) {
    const sorted = [...list].sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.type === b.type ? 0 : a.type === 'income' ? -1 : 1));
    let bal = 0;
    for (const t of sorted) {
      bal += t.type === 'income' ? t.amount : -t.amount;
      if (bal < -0.005) return t.date;
    }
    return null;
  }

  function fmtDay(dateStr) {
    return new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

    /* ── Form Validation ── */
      const MAX_AMOUNT = 100000000; // ₹10 crore
      const MIN_DATE   = '2000-01-01';
      const FIELD_ERROR = { amount: 'amountError', date: 'dateError', category: 'categoryError' };
   
      function clearFieldError(inputId) {
        $(FIELD_ERROR[inputId]).textContent = '';
        const input = $(inputId);
        input.style.borderColor = '';
        input.removeAttribute('aria-invalid');
        const parent = input.closest('.input-prefix');
        if (parent) parent.style.borderColor = '';
      }
   
      function clearFormErrors() {
        Object.keys(FIELD_ERROR).forEach(clearFieldError);
      }
   
      function setFieldError(inputId, message) {
        $(FIELD_ERROR[inputId]).textContent = message;
        const input = $(inputId);
        input.style.borderColor = 'var(--danger)';
        input.setAttribute('aria-invalid', 'true');
        const parent = input.closest('.input-prefix');
        if (parent) parent.style.borderColor = 'var(--danger)';
      }
   
      function validateForm() {
        clearFormErrors();
        const errors = {};
   
        // Amount
        const raw = els.amount.value.trim();
        const amtVal = parseFloat(raw);
        if (els.amount.validity.badInput) {
          errors.amount = 'Enter numbers only, e.g. 250 or 250.50.';
        } else if (raw === '') {
          errors.amount = 'Amount is required.';
        } else if (isNaN(amtVal) || amtVal <= 0) {
          errors.amount = 'Amount must be greater than ₹0.';
        } else if (/\.\d{3,}/.test(raw)) {
          errors.amount = 'Use at most 2 decimal places, e.g. 250.75.';
        } else if (amtVal > MAX_AMOUNT) {
          errors.amount = `Amount is too large. The maximum is ${formatCurrency(MAX_AMOUNT)}.`;
        }
   
        // Date
        const dateVal = els.date.value;
        if (!dateVal) {
          errors.date = 'Please select a date.';
        } else if (dateVal > getTodayStr()) {
          errors.date = "Date can't be in the future.";
        } else if (dateVal < MIN_DATE) {
          errors.date = 'Date must be in the year 2000 or later.';
        }
   
        // Category
        const validCats = CATEGORIES[currentFormType].map(c => c.value);
        if (!els.category.value) {
          errors.category = 'Please select a category.';
        } else if (!validCats.includes(els.category.value)) {
          errors.category = `That category doesn't belong to ${currentFormType}. Please choose again.`;
        }
   
        // Balance rule: running balance must never go below ₹0 on any date
        if (!errors.amount && !errors.date) {
          const amount  = parseFloat(amtVal.toFixed(2));
          const editId  = els.editId.value;
          const updated = { type: currentFormType, amount, date: dateVal };
          const nextList = editId
            ? transactions.map(t => t.id === editId ? { ...t, ...updated } : t)
            : [...transactions, updated];

          const badDate = firstNegativeDate(nextList);
          if (badDate) {
            errors.amount = currentFormType === 'expense'
              ? `The math doesn't add up on ${fmtDay(badDate)}. Add income on or before that date, or pick a later date.`
              : `This change would make your balance negative on ${fmtDay(badDate)}.`;
          }
        }
   
        const fields = Object.keys(errors);
        fields.forEach(f => setFieldError(f, errors[f]));
        if (fields.length) $(fields[0]).focus();
        return fields.length === 0;
      }
   
   /* ── CRUD ── */
   function addTransaction(data) {
     transactions.push({ ...data, id: generateId(), createdAt: Date.now() });
     saveToStorage();
     refresh();
     showToast('Transaction added!', 'success');
   }
   
   function updateTransaction(id, data) {
     const idx = transactions.findIndex(t => t.id === id);
     if (idx === -1) return;
     transactions[idx] = { ...transactions[idx], ...data };
     saveToStorage();
     refresh();
     showToast('Transaction updated!', 'info');
   }
   
   function deleteTransaction(id) {
     const nextList = transactions.filter(t => t.id !== id);
     const badDate = firstNegativeDate(nextList);
     if (badDate) {
       showToast(`Cannot delete: balance would go below ₹0 on ${fmtDay(badDate)}.`, 'error'); 
       return false;
     }
     transactions = nextList;
     saveToStorage();
     refresh();
     showToast('Transaction deleted.', 'error');
     return true;
   }
   
   /* ── Delete Modal ── */
   function openDeleteModal(id) {
     deleteTargetId = id;
     els.deleteOverlay.classList.add('open');
   }
   
   function closeDeleteModal() {
     deleteTargetId = null;
     els.deleteOverlay.classList.remove('open');
   }
   
   /* ── Event Listeners ── */
   
   // Form submit
   els.transactionForm.addEventListener('submit', e => {
     e.preventDefault();
     if (!validateForm()) return;
   
     const data = {
       type:        currentFormType,
       amount:      parseFloat(parseFloat(els.amount.value).toFixed(2)),
       date:        els.date.value,
       category:    els.category.value,
       description: els.description.value.trim(),
     };
   
     const id = els.editId.value;
     id ? updateTransaction(id, data) : addTransaction(data);
     closeModal();
   });
   
   // Type toggle in modal
   els.typeToggle.addEventListener('click', e => {
     const btn = e.target.closest('.type-btn');
     if (!btn) return;
     setFormType(btn.dataset.type);
   });
   
   // Filter events
   els.typeFilter.addEventListener('click', e => {
     const pill = e.target.closest('.pill');
     if (!pill) return;
     [...els.typeFilter.querySelectorAll('.pill')].forEach(p => p.classList.remove('active'));
     pill.classList.add('active');
     activeType = pill.dataset.value;
     renderTransactions();
   });
   
   els.categoryFilter.addEventListener('change', () => {
     activeCategory = els.categoryFilter.value;
     renderTransactions();
   });
   
   els.searchInput.addEventListener('input', () => {
     searchQuery = els.searchInput.value.trim();
     renderTransactions();
   });
    // Month selector
      els.monthSelect.addEventListener('change', () => {
        selectedMonth = els.monthSelect.value;
        renderMonthly();
      });
   
    // Clear a field's error as soon as the user edits it
      ['amount', 'date', 'category'].forEach(id => {
        $(id).addEventListener('input',  () => clearFieldError(id));
        $(id).addEventListener('change', () => clearFieldError(id));
      });
   // Modal buttons
   $('openAddModal').addEventListener('click', openAddModal);
   $('fabAdd').addEventListener('click', openAddModal);   // mobile floating button
   $('closeModal').addEventListener('click', closeModal);
   $('cancelModal').addEventListener('click', closeModal);
   
   els.modalOverlay.addEventListener('click', e => {
     if (e.target === els.modalOverlay) closeModal();
   });
   
   $('closeDelete').addEventListener('click', closeDeleteModal);
   $('cancelDelete').addEventListener('click', closeDeleteModal);
   
   els.deleteOverlay.addEventListener('click', e => {
     if (e.target === els.deleteOverlay) closeDeleteModal();
   });
   
   $('confirmDelete').addEventListener('click', () => {
     if (deleteTargetId && deleteTransaction(deleteTargetId)) closeDeleteModal();
     else if (!deleteTargetId) closeDeleteModal();
   });
   
   // Keyboard shortcuts
   document.addEventListener('keydown', e => {
     if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
     if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openAddModal(); }
   });
   // Stop mouse wheel from changing the amount value
els.amount.addEventListener('wheel', () => {
  els.amount.blur();
}, { passive: true });
   /* ── Init ── */
   function init() {
    els.date.max = getTodayStr();
     loadFromStorage();
     refresh();
   }
   
   init();