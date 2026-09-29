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
   
   /* ── Full Refresh ── */
   function refresh() {
     renderSummary();
     buildCategoryFilterOptions();
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
   
   /* ── Form Validation ── */
   function clearFormErrors() {
     ['amountError', 'dateError', 'categoryError'].forEach(id => $(id).textContent = '');
     ['amount', 'date', 'category'].forEach(id => {
       $(id).style.borderColor = '';
       const parent = $(id).closest('.input-prefix');
       if (parent) parent.style.borderColor = '';
     });
   }
   
   function setFieldError(inputId, errorId, message) {
     $(errorId).textContent = message;
     const input = $(inputId);
     input.style.borderColor = 'var(--danger)';
     const parent = input.closest('.input-prefix');
     if (parent) parent.style.borderColor = 'var(--danger)';
   }
   
   function validateForm() {
     let valid = true;
     clearFormErrors();
   
     const amtVal = parseFloat(els.amount.value);
     if (!els.amount.value || isNaN(amtVal) || amtVal <= 0) {
       setFieldError('amount', 'amountError', 'Enter a valid amount greater than 0.');
       valid = false;
     }
   
     if (!els.date.value) {
       setFieldError('date', 'dateError', 'Please select a date.');
       valid = false;
     }
   
     if (!els.category.value) {
       setFieldError('category', 'categoryError', 'Please select a category.');
       valid = false;
     }
   
     if (valid && currentFormType === 'expense') {
       const amount  = parseFloat(parseFloat(els.amount.value).toFixed(2));
       const editId  = els.editId.value;
       const nextList = editId
         ? transactions.map(t => t.id === editId ? { ...t, type: currentFormType, amount } : t)
         : [...transactions, { type: currentFormType, amount }];
   
       if (getTotals(nextList).balance < 0) {
         const available = editId
           ? getTotals(transactions.filter(t => t.id !== editId)).balance
           : getTotals().balance;
         setFieldError('amount', 'amountError',
           `Insufficient balance. Available: ${formatCurrency(Math.max(0, available))}.`);
         valid = false;
       }
     }
   
     return valid;
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
     if (getTotals(nextList).balance < 0) {
       showToast('Cannot delete: expenses would exceed remaining balance.', 'error');
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
     loadFromStorage();
     refresh();
   }
   
   init();