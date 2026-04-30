import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Coffee, Menu as MenuIcon, X, LayoutGrid, BarChart3,
  History, Plus, Minus, Trash2, Edit, CheckCircle, TrendingUp,
  Sun, Moon, Award, Wallet
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isSameDay, startOfWeek, eachDayOfInterval, subWeeks, startOfMonth, eachWeekOfInterval, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from './supabase';
import './index.css';

const DEFAULT_CATEGORIES = ['Coffee', 'Non-Coffee'];

function LoginPage({ onEnter }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const CORRECT_PIN = '0834';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      onEnter();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-logo">
          <Coffee size={56} color="var(--color-brand)" />
        </div>
        <h1 className="login-title">Kape sa Garahe</h1>
        <p className="login-subtitle">Your personal café POS</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" style={{ width: '100%' }}>
          <input
            type="password"
            className="form-control text-center"
            placeholder="Enter PIN"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(false); }}
            maxLength={6}
            autoFocus
            style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }}
          />
          {error && <p className="text-danger text-center" style={{ fontSize: '0.9rem' }}>Incorrect PIN. Try again.</p>}
          <button type="submit" className="btn-checkout login-btn">Enter</button>
        </form>
      </div>
    </div>
  );
}

// Hardcoded base rules — these always apply regardless of user settings
const BASE_CATEGORY_RULES = {
  'Soda':       { allowTemperature: false },
  'Pop':        { allowTemperature: false },
  'Snacks':     { allowTemperature: false },
  'Add-ons':    { allowTemperature: false },
  'Coffee':     { allowTemperature: true  },
  'Non-Coffee': { allowTemperature: true  },
};

function MenuCard({ item, cart, onAdd, categoryRules }) {
  const rule = categoryRules[item.category];
  const showTemp = rule ? rule.allowTemperature : false;
  const [itemTemp, setItemTemp] = React.useState('Cold');
  const [itemQty, setItemQty] = React.useState(1);
  const qtyInCart = cart.filter(i => i.id === item.id).reduce((s, i) => s + i.qty, 0);
  const btnStyle = (active) => ({
    padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    backgroundColor: active ? 'var(--color-text)' : 'var(--color-surface-hover)',
    color: active ? '#fff' : 'var(--color-text)',
  });
  const effectiveTemp = showTemp ? itemTemp : null;
  return (
    <div className="menu-list-card">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div className="menu-list-image">
          {item.image_url
            ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Coffee size={32} opacity={0.2} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '0.1rem' }}>{item.name}</div>
          <div style={{ fontWeight: 800, color: 'var(--color-brand)', fontSize: '0.95rem' }}>₱{item.price}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {showTemp ? (
            <>
              <button onClick={() => setItemTemp('Hot')} style={btnStyle(itemTemp === 'Hot')}>Hot</button>
              <button onClick={() => setItemTemp('Cold')} style={btnStyle(itemTemp === 'Cold')}>Cold</button>
            </>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No temp</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button onClick={() => setItemQty(q => Math.max(1, q - 1))} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={11} /></button>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', minWidth: 16, textAlign: 'center' }}>{itemQty}</span>
          <button onClick={() => setItemQty(q => q + 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={11} /></button>
        </div>
      </div>
      <button onClick={() => { onAdd(item, itemQty, effectiveTemp); setItemQty(1); }} style={{ width: '100%', backgroundColor: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: '999px', padding: '0.55rem 0', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'background 0.2s' }}>
        {qtyInCart > 0 ? `Added (${qtyInCart})` : 'Add to Cart'}
      </button>
    </div>
  );
}

function POSApp({ onLogout }) {
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('pos');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // POS State
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashReceived, setCashReceived] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedTemp, setSelectedTemp] = useState('Cold');
  const [selectedQty, setSelectedQty] = useState(1);
  // Discount State
  const [orderDiscount, setOrderDiscount] = useState({ type: 'percent', value: '' });
  const [itemDiscounts, setItemDiscounts] = useState({});

  // Refund State
  const [orderToRefund, setOrderToRefund] = useState(null);

  // Menu Management State
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: 'Coffee' });
  const [menuImageFile, setMenuImageFile] = useState(null);
  const [menuImagePreview, setMenuImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [mmActiveCategory, setMmActiveCategory] = useState('');
  const [renamingCategory, setRenamingCategory] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [newCategoryAllowTemp, setNewCategoryAllowTemp] = useState(false);
  // Dynamic category rules — persisted in localStorage
  const [categoryRules, setCategoryRules] = useState(() => {
    try {
      const saved = localStorage.getItem('kape_category_rules');
      return saved ? { ...BASE_CATEGORY_RULES, ...JSON.parse(saved) } : { ...BASE_CATEGORY_RULES };
    } catch { return { ...BASE_CATEGORY_RULES }; }
  });
  const hasTemp = (category) => {
    const rule = categoryRules[category];
    return rule ? rule.allowTemperature : false;
  };
  const toggleCategoryTemp = (cat) => {
    // Base rules for Soda/Pop/Snacks/Add-ons cannot be overridden
    if (BASE_CATEGORY_RULES[cat]?.allowTemperature === false) return;
    setCategoryRules(prev => {
      const updated = { ...prev, [cat]: { allowTemperature: !prev[cat]?.allowTemperature } };
      localStorage.setItem('kape_category_rules', JSON.stringify(updated));
      return updated;
    });
  };

  // Filters State
  const [historyFilterDate, setHistoryFilterDate] = useState('');
  const [summaryFilterDate, setSummaryFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Chart State
  const [chartMode, setChartMode] = useState('weekly');
  const [overallMode, setOverallMode] = useState('month');

  // Theme
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kape_theme') === 'dark');

  // Expenses
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('kape_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // -------------------------------------------------------------
  // Supabase Fetch
  // -------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: menuData }, { data: ordersData }] = await Promise.all([
      supabase.from('menu_items').select('*').order('name'),
      supabase.from('orders').select('*').order('date', { ascending: false }),
    ]);
    const { data: expensesData } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (menuData) setMenuItems(menuData);
    if (ordersData) setOrders(ordersData);
    if (expensesData) setExpenses(expensesData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // -------------------------------------------------------------
  // Derived Data
  // -------------------------------------------------------------
  const categories = ['All', ...Array.from(new Set([...DEFAULT_CATEGORIES, ...menuItems.map(m => m.category)]))];
  const dropdownCategories = categories.filter(c => c !== 'All');

  const summaryDateObj = useMemo(() => summaryFilterDate ? parseISO(summaryFilterDate) : new Date(), [summaryFilterDate]);
  const summaryOrders = useMemo(() => orders.filter(o => isSameDay(parseISO(o.date), summaryDateObj)), [orders, summaryDateObj]);
  const summaryRevenue = summaryOrders.filter(o => !o.refunded).reduce((sum, o) => sum + o.total, 0);
  const summaryItemsSold = summaryOrders.filter(o => !o.refunded).reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);
  const summaryCashRevenue = summaryOrders.filter(o => !o.refunded && (o.payment_method === 'Cash' || !o.payment_method)).reduce((sum, o) => sum + o.total, 0);
  const summaryGCashRevenue = summaryOrders.filter(o => !o.refunded && o.payment_method === 'GCash').reduce((sum, o) => sum + o.total, 0);
  const summaryExpenses = useMemo(() => expenses.filter(e => isSameDay(parseISO(e.date), summaryDateObj)).reduce((sum, e) => sum + e.amount, 0), [expenses, summaryDateObj]);

  const filteredHistoryOrders = useMemo(() => {
    if (!historyFilterDate) return orders;
    const filterDateObj = parseISO(historyFilterDate);
    return orders.filter(o => isSameDay(parseISO(o.date), filterDateObj));
  }, [orders, historyFilterDate]);

  const cartSubtotal = cart.reduce((sum, item) => {
    const itemDisc = itemDiscounts[item.cartId];
    const itemTotal = item.price * item.qty;
    if (!itemDisc || !itemDisc.value) return sum + itemTotal;
    const discAmt = itemDisc.type === 'percent' ? itemTotal * (parseFloat(itemDisc.value) / 100) : parseFloat(itemDisc.value);
    return sum + Math.max(0, itemTotal - discAmt);
  }, 0);
  const orderDiscountAmt = !orderDiscount.value ? 0 : orderDiscount.type === 'percent' ? cartSubtotal * (parseFloat(orderDiscount.value) / 100) : parseFloat(orderDiscount.value);
  const cartTotal = Math.max(0, cartSubtotal - orderDiscountAmt);
  const filteredMenuItems = activeCategory === 'All' ? menuItems : menuItems.filter(m => m.category === activeCategory);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const addToCart = (item, qty = 1, temp = null) => {
    const cartId = `${item.id}-${temp ?? 'none'}`;
    const displayName = temp ? `${item.name} (${temp})` : item.name;
    const cartItem = { ...item, cartId, temp, name: displayName };
    setCart(prev => {
      const existing = prev.find(i => i.cartId === cartId);
      if (existing) return prev.map(i => i.cartId === cartId ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { ...cartItem, qty }];
    });
  };

  const updateCartQty = (cartId, delta) => {
    setCart(prev =>
      prev.map(item => item.cartId === cartId ? { ...item, qty: item.qty + delta } : item)
         .filter(item => item.qty > 0)
    );
  };

  const confirmCheckout = async () => {
    if (cart.length === 0) return;
    const newOrder = {
      id: uuidv4(),
      date: new Date().toISOString(),
      items: cart,
      subtotal: cartSubtotal,
      discount_amount: parseFloat((cartSubtotal - cartTotal).toFixed(2)),
      total: cartTotal,
      payment_method: paymentMethod,
      refunded: false,
    };
    const { error } = await supabase.from('orders').insert([newOrder]);
    if (!error) {
      setOrders(prev => [newOrder, ...prev]);
      setCart([]);
      setPaymentMethod('Cash');
      setCashReceived('');
      setOrderDiscount({ type: 'percent', value: '' });
      setItemDiscounts({});
      setShowCheckoutModal(false);
    }
  };

  const confirmRefund = async () => {
    if (!orderToRefund) return;
    const { error } = await supabase.from('orders').update({ refunded: true }).eq('id', orderToRefund.id);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderToRefund.id ? { ...o, refunded: true } : o));
      setOrderToRefund(null);
    }
  };

  const saveMenuItem = async (e) => {
    e.preventDefault();
    if (!menuForm.name || !menuForm.price || !menuForm.category) return;
    const price = parseFloat(menuForm.price);

    let imageUrl = editingMenuId ? menuItems.find(m => m.id === editingMenuId)?.image_url : null;

    if (menuImageFile) {
      setUploadingImage(true);
      const fileExt = menuImageFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('menu-images').upload(fileName, menuImageFile);
      if (!uploadError) {
        const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }
      setUploadingImage(false);
    }

    if (editingMenuId) {
      const { error } = await supabase.from('menu_items')
        .update({ name: menuForm.name, price, category: menuForm.category, image_url: imageUrl })
        .eq('id', editingMenuId);
      if (!error) {
        setMenuItems(prev => prev.map(m => m.id === editingMenuId ? { ...m, name: menuForm.name, price, category: menuForm.category, image_url: imageUrl } : m));
        setEditingMenuId(null);
      }
    } else {
      const newItem = { id: uuidv4(), name: menuForm.name, price, category: menuForm.category, image_url: imageUrl };
      const { error } = await supabase.from('menu_items').insert([newItem]);
      if (error) { alert('Error saving item: ' + error.message); return; }
      setMenuItems(prev => [...prev, newItem]);
    }
    setMenuForm({ name: '', price: '', category: dropdownCategories[0] || 'Coffee' });
    setMenuImageFile(null);
    setMenuImagePreview(null);
    setIsAddingNewCategory(false);
    // Register new category rule if it doesn't exist yet
    if (menuForm.category && !categoryRules[menuForm.category]) {
      setCategoryRules(prev => {
        const updated = { ...prev, [menuForm.category]: { allowTemperature: newCategoryAllowTemp } };
        localStorage.setItem('kape_category_rules', JSON.stringify(updated));
        return updated;
      });
    }
    setNewCategoryAllowTemp(false);
  };

  const editMenuItem = (item) => {
    setMenuForm({ name: item.name, price: item.price, category: item.category });
    setMenuImagePreview(item.image_url || null);
    setMenuImageFile(null);
    setIsAddingNewCategory(false);
    setEditingMenuId(item.id);
  };

  const [orderToDelete, setOrderToDelete] = useState(null);

  const saveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount) return;
    const newExpense = { id: uuidv4(), date: new Date().toISOString(), description: expenseForm.description, amount: parseFloat(expenseForm.amount) };
    const { error } = await supabase.from('expenses').insert([newExpense]);
    if (!error) {
      setExpenses(prev => [newExpense, ...prev]);
      setExpenseForm({ description: '', amount: '' });
    }
  };

  const deleteExpense = async () => {
    if (!expenseToDelete) return;
    const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete.id);
    if (!error) {
      setExpenses(prev => prev.filter(e => e.id !== expenseToDelete.id));
      setExpenseToDelete(null);
    }
  };

  const updatePaymentMethod = async (order, method) => {
    const { error } = await supabase.from('orders').update({ payment_method: method }).eq('id', order.id);
    if (!error) setOrders(prev => prev.map(o => o.id === order.id ? { ...o, payment_method: method } : o));
  };

  const deleteOrder = async () => {
    if (!orderToDelete) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderToDelete.id);
    if (error) { alert('Error deleting order: ' + error.message); return; }
    setOrders(prev => prev.filter(o => o.id !== orderToDelete.id));
    setOrderToDelete(null);
  };

  const confirmDeleteMenuItem = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', itemToDelete.id);
    if (!error) {
      setMenuItems(prev => prev.filter(m => m.id !== itemToDelete.id));
      setItemToDelete(null);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const { error } = await supabase.from('menu_items').delete().eq('category', categoryToDelete);
    if (!error) {
      setMenuItems(prev => prev.filter(m => m.category !== categoryToDelete));
      if (mmActiveCategory === categoryToDelete) setMmActiveCategory('');
      setCategoryToDelete(null);
    }
  };

  // Auto-remove temperature from cart items whose category disallows it
  useEffect(() => {
    setCart(prev => {
      const updated = prev.map(item => {
        if (!hasTemp(item.category) && item.temp) {
          const baseName = item.name.replace(/ \((Hot|Cold)\)$/, '');
          return { ...item, temp: null, name: baseName, cartId: `${item.id}-none` };
        }
        return item;
      });
      const merged = [];
      updated.forEach(item => {
        const existing = merged.find(i => i.cartId === item.cartId);
        if (existing) existing.qty += item.qty;
        else merged.push({ ...item });
      });
      return merged;
    });
  }, [categoryRules]);

  const confirmRenameCategory = async () => {
    if (!renamingCategory || !renameValue.trim()) return;
    const { error } = await supabase.from('menu_items').update({ category: renameValue.trim() }).eq('category', renamingCategory);
    if (!error) {
      setMenuItems(prev => prev.map(m => m.category === renamingCategory ? { ...m, category: renameValue.trim() } : m));
      if (mmActiveCategory === renamingCategory) setMmActiveCategory(renameValue.trim());
      setRenamingCategory(null);
      setRenameValue('');
    }
  };

  const [openCategoryMenu, setOpenCategoryMenu] = useState(null);

  const categoryScrollRef = React.useRef(null);

  useEffect(() => {
    const close = () => setOpenCategoryMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const handleCategoryWheel = (e) => {
    if (categoryScrollRef.current) {
      e.preventDefault();
      categoryScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // -------------------------------------------------------------
  // Views
  // -------------------------------------------------------------
  const renderPOS = () => (
    <div className="pos-layout">
      <div className="pos-menu-area">
        <div className="category-filters-wrapper">
          <div
            className="category-filters"
            ref={categoryScrollRef}
            onWheel={handleCategoryWheel}
          >
            {categories.map(cat => {
              const itemCount = cat === 'All' ? menuItems.length : menuItems.filter(m => m.category === cat).length;
              return (
                <button
                  key={cat}
                  className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  <div>{cat}</div>
                  <div className="category-pill-count">{itemCount} items</div>
                </button>
              );
            })}
          </div>
        </div>

        {filteredMenuItems.length === 0 ? (
          <p className="text-muted text-center py-8">No menu items found in this category.</p>
        ) : (
          <div className="menu-list">
            {filteredMenuItems.map(item => (
              <MenuCard key={item.id} item={item} cart={cart} onAdd={addToCart} categoryRules={categoryRules} />
            ))}
          </div>
        )}
      </div>

      <div className="pos-cart-area">
        <div className="cart-header">
          <h2 className="title" style={{ fontSize: '1.25rem', margin: 0 }}>Current Order</h2>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <p className="text-muted text-center py-8" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <Coffee size={48} opacity={0.3} />
              Cart is empty
            </p>
          ) : (
            cart.map(item => {
              const itemDisc = itemDiscounts[item.cartId];
              const itemTotal = item.price * item.qty;
              const discAmt = itemDisc?.value ? (itemDisc.type === 'percent' ? itemTotal * (parseFloat(itemDisc.value) / 100) : parseFloat(itemDisc.value)) : 0;
              const discountedTotal = Math.max(0, itemTotal - discAmt);
              return (
              <div key={item.cartId} className="cart-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="cart-item-image-placeholder" style={{ overflow: 'hidden', borderRadius: 12 }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Coffee size={24} />}
                  </div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">
                      {discAmt > 0 ? <><span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>₱{itemTotal.toLocaleString()}</span> <span style={{ color: 'var(--color-brand)', fontWeight: 700 }}>₱{discountedTotal.toLocaleString()}</span></> : `₱${item.price} x ${item.qty}`}
                    </div>
                  </div>
                  <div className="cart-item-controls">
                    <button className="cart-qty-btn" onClick={() => updateCartQty(item.cartId, -1)}><Minus size={14} /></button>
                    <span className="cart-qty">{item.qty}</span>
                    <button className="cart-qty-btn" onClick={() => updateCartQty(item.cartId, 1)}><Plus size={14} /></button>
                  </div>
                </div>
                {/* Item discount row */}
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', paddingLeft: '0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Item disc:</span>
                  <select value={itemDiscounts[item.cartId]?.type || 'percent'} onChange={e => setItemDiscounts(prev => ({ ...prev, [item.cartId]: { ...prev[item.cartId], type: e.target.value, value: prev[item.cartId]?.value || '' } }))} style={{ fontSize: '0.72rem', padding: '0.1rem 0.25rem', borderRadius: 6, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
                    <option value="percent">%</option>
                    <option value="fixed">₱</option>
                  </select>
                  <input type="number" min="0" placeholder="0" value={itemDiscounts[item.cartId]?.value || ''} onChange={e => setItemDiscounts(prev => ({ ...prev, [item.cartId]: { type: prev[item.cartId]?.type || 'percent', value: e.target.value } }))} style={{ width: 48, fontSize: '0.72rem', padding: '0.1rem 0.35rem', borderRadius: 6, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} />
                  {itemDisc?.value && <span style={{ fontSize: '0.72rem', color: 'var(--color-brand)', fontWeight: 700 }}>-₱{discAmt.toFixed(2)}</span>}
                </div>
              </div>
              );
            })
          )}
        </div>

        <div className="cart-footer">
          {/* Order-level discount */}
          {cart.length > 0 && (
            <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 12 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>ORDER DISCOUNT</div>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <select value={orderDiscount.type} onChange={e => setOrderDiscount(d => ({ ...d, type: e.target.value }))} style={{ fontSize: '0.8rem', padding: '0.25rem 0.4rem', borderRadius: 8, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontWeight: 600 }}>
                  <option value="percent">% Off</option>
                  <option value="fixed">₱ Off</option>
                </select>
                <input type="number" min="0" placeholder="0" value={orderDiscount.value} onChange={e => setOrderDiscount(d => ({ ...d, value: e.target.value }))} style={{ flex: 1, fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: 8, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} />
                {orderDiscount.value && <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)', fontWeight: 700, whiteSpace: 'nowrap' }}>-₱{orderDiscountAmt.toFixed(2)}</span>}
              </div>
            </div>
          )}
          <div className="cart-total-row">
            {cartSubtotal !== cartTotal && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>₱{cartSubtotal.toLocaleString()}</span>
              </div>
            )}
            <span className="cart-total-label">Total Amount</span>
            <span className="cart-total-value">₱{cartTotal.toLocaleString()}</span>
          </div>
          <button
            className="btn-checkout"
            disabled={cart.length === 0}
            onClick={() => setShowCheckoutModal(true)}
          >
            <CheckCircle size={20} /> Proceed to Checkout
          </button>
        </div>
      </div>

      {showCheckoutModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Confirm Payment</h2>
            <div className="modal-body">
              <div className="flex justify-between items-center" style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-surface-hover)', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600 }}>Total Items:</span>
                <span className="text-muted font-bold">{cart.reduce((s, i) => s + i.qty, 0)} items</span>
              </div>
              <div className="flex justify-between items-center" style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-surface-hover)', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600 }}>Total Due:</span>
                <span className="text-brand" style={{ fontSize: '1.5rem', fontWeight: 800 }}>₱{cartTotal.toLocaleString()}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Payment Method:</span>
                <div className="flex gap-2">
                  {['Cash', 'GCash'].map(method => (
                    <button key={method} type="button" className="btn flex-1" style={{ backgroundColor: paymentMethod === method ? 'var(--color-brand)' : 'var(--color-surface-hover)', color: paymentMethod === method ? '#fff' : 'var(--color-text)', fontWeight: 700 }} onClick={() => { setPaymentMethod(method); setCashReceived(''); }}>
                      {method === 'Cash' ? '💵' : '📱'} {method}
                    </button>
                  ))}
                </div>
              </div>
              {paymentMethod === 'Cash' && (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Cash Received:</span>
                  <input type="number" className="form-control" placeholder={`Minimum ₱${cartTotal.toLocaleString()}`} value={cashReceived} min={cartTotal} onChange={e => setCashReceived(e.target.value)} />
                  {cashReceived !== '' && parseFloat(cashReceived) >= cartTotal && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '12px', backgroundColor: 'var(--color-surface-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Change:</span>
                      <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-brand)' }}>₱{(parseFloat(cashReceived) - cartTotal).toLocaleString()}</span>
                    </div>
                  )}
                  {cashReceived !== '' && parseFloat(cashReceived) < cartTotal && (
                    <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>Amount is less than the total.</p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => setShowCheckoutModal(false)}>Cancel</button>
              <button className="btn btn-primary w-full" onClick={confirmCheckout} disabled={paymentMethod === 'Cash' && (cashReceived === '' || parseFloat(cashReceived) < cartTotal)}>Confirm Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMenuManagement = () => (
    <div style={{ padding: '1.5rem', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 className="title" style={{ fontSize: '1.3rem', marginBottom: '0.15rem' }}>Menu Management</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Organize your offerings and update item availability.</p>
      </div>

      {/* Category Cards */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem', flexShrink: 0, scrollbarWidth: 'none' }}>
        {/* All card */}
        <div
          onClick={() => { setMmActiveCategory(''); setOpenCategoryMenu(null); }}
          style={{ flexShrink: 0, minWidth: 90, borderRadius: 12, border: `1.5px solid ${mmActiveCategory === '' ? 'var(--color-brand)' : 'var(--color-border)'}`, backgroundColor: mmActiveCategory === '' ? 'var(--color-brand)' : 'var(--color-surface)', padding: '0.5rem 0.85rem', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: mmActiveCategory === '' ? '#fff' : 'var(--color-text)', whiteSpace: 'nowrap' }}>All</span>
          <span style={{ fontSize: '0.72rem', color: mmActiveCategory === '' ? 'rgba(255,255,255,0.75)' : 'var(--color-text-muted)', fontWeight: 600 }}>{menuItems.length} items</span>
        </div>

        {dropdownCategories.map(cat => {
          const count = menuItems.filter(m => m.category === cat).length;
          const isActive = mmActiveCategory === cat;
          const tempOn = hasTemp(cat);
          const locked = BASE_CATEGORY_RULES[cat]?.allowTemperature === false;
          return (
            <div key={cat} style={{ flexShrink: 0, minWidth: 130, maxWidth: 160, borderRadius: 12, border: `1.5px solid ${isActive ? 'var(--color-brand)' : 'var(--color-border)'}`, backgroundColor: isActive ? 'var(--color-brand)' : 'var(--color-surface)', padding: '0.5rem 0.75rem', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              {/* Top: name + count — clickable */}
              <div onClick={() => { setMmActiveCategory(cat); setOpenCategoryMenu(null); }} style={{ cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isActive ? '#fff' : 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</div>
                <div style={{ fontSize: '0.72rem', color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>{count} items{!locked && (tempOn ? ' · 🌡️' : ' · no temp')}</div>
              </div>
              {/* Bottom: action buttons always visible */}
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <button
                  onClick={e => { e.stopPropagation(); setRenamingCategory(cat); setRenameValue(cat); }}
                  title="Rename"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.25rem 0', borderRadius: 7, border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : 'var(--color-border)'}`, background: isActive ? 'rgba(255,255,255,0.12)' : 'var(--color-bg)', color: isActive ? '#fff' : 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                ><Edit size={10} /> Edit</button>
                {!locked && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleCategoryTemp(cat); }}
                    title={tempOn ? 'Disable Hot/Cold' : 'Enable Hot/Cold'}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem 0.4rem', borderRadius: 7, border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : 'var(--color-border)'}`, background: isActive ? 'rgba(255,255,255,0.12)' : 'var(--color-bg)', color: isActive ? (tempOn ? '#fff' : 'rgba(255,255,255,0.5)') : (tempOn ? 'var(--color-brand)' : 'var(--color-text-muted)'), fontSize: '0.75rem', cursor: 'pointer' }}
                  >🌡️</button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setCategoryToDelete(cat); }}
                  title="Delete"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem 0.4rem', borderRadius: 7, border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : 'var(--color-border)'}`, background: isActive ? 'rgba(255,255,255,0.12)' : 'var(--color-bg)', color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--color-danger)', fontSize: '0.7rem', cursor: 'pointer' }}
                ><Trash2 size={10} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="mm-layout" style={{ flex: 1, minHeight: 0 }}>

        {/* Left: Form */}
        <div className="card mm-form-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--color-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: editingMenuId ? 'var(--color-brand)' : 'var(--color-text)' }}>
              {editingMenuId ? 'Edit Item' : 'Add New Item'}
            </span>
          </div>
          <form onSubmit={saveMenuItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Item Name</label>
              <input type="text" className="form-control" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="e.g. Mocha Frappe" required style={{ fontSize: '0.9rem', padding: '0.65rem 0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Price (₱)</label>
              <input type="number" className="form-control" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} placeholder="0.00" min="1" required style={{ fontSize: '0.9rem', padding: '0.65rem 0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Category</label>
              {!isAddingNewCategory ? (
                <div style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setShowCategoryDropdown(d => !d)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', borderRadius: 12, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                    <span>{menuForm.category || 'Select a category'}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>▼</span>
                  </button>
                  {showCategoryDropdown && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden' }}>
                      {dropdownCategories.map(c => (
                        <button key={c} type="button" onClick={() => { setMenuForm({ ...menuForm, category: c }); setShowCategoryDropdown(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.65rem 1rem', fontSize: '0.9rem', fontWeight: menuForm.category === c ? 700 : 500, color: menuForm.category === c ? 'var(--color-brand)' : 'var(--color-text)', backgroundColor: menuForm.category === c ? 'rgba(13,92,49,0.06)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {c}
                          {menuForm.category === c && <span style={{ color: 'var(--color-brand)', fontSize: '0.8rem' }}>✓</span>}
                        </button>
                      ))}
                      <div style={{ borderTop: '1px solid var(--color-border)' }}>
                        <button type="button" onClick={() => { setIsAddingNewCategory(true); setMenuForm({ ...menuForm, category: '' }); setShowCategoryDropdown(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.65rem 1rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-brand)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}>+ Add new category...</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="flex gap-2">
                    <input type="text" className="form-control" value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} placeholder="New category name..." required autoFocus style={{ fontSize: '0.9rem', padding: '0.65rem 0.85rem' }} />
                    <button type="button" className="btn" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '0.65rem 1rem', fontSize: '0.85rem' }} onClick={() => { setIsAddingNewCategory(false); setMenuForm({ ...menuForm, category: dropdownCategories[0] || 'Coffee' }); setShowCategoryDropdown(false); }}>Cancel</button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    <div onClick={() => setNewCategoryAllowTemp(v => !v)} style={{ width: 36, height: 20, borderRadius: 999, backgroundColor: newCategoryAllowTemp ? 'var(--color-brand)' : 'var(--color-border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 2, left: newCategoryAllowTemp ? 18 : 2, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s' }} />
                    </div>
                    Allow Hot/Cold for this category
                  </label>
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Item Image</label>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: '1.5px dashed var(--color-border)', borderRadius: 12, padding: '1.25rem', cursor: 'pointer', backgroundColor: 'var(--color-bg)', transition: 'border-color 0.2s' }}>
                {menuImagePreview
                  ? <img src={menuImagePreview} alt="Preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} />
                  : <>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>📷</div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Click to upload image</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>PNG, JPG up to 5MB</span>
                    </>}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files[0]; if (file) { setMenuImageFile(file); setMenuImagePreview(URL.createObjectURL(file)); } }} />
              </label>
              {menuImagePreview && <button type="button" onClick={() => { setMenuImageFile(null); setMenuImagePreview(null); }} style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 600 }}>Remove image</button>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button type="submit" disabled={uploadingImage} style={{ flex: 1, backgroundColor: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                {uploadingImage ? 'Uploading...' : editingMenuId ? 'Update Item' : 'Save Item'}
              </button>
              {editingMenuId && (
                <button type="button" style={{ backgroundColor: 'var(--color-surface-hover)', border: 'none', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', color: 'var(--color-text)' }} onClick={() => { setEditingMenuId(null); setMenuForm({ name: '', price: '', category: dropdownCategories[0] || 'Coffee' }); setMenuImageFile(null); setMenuImagePreview(null); setIsAddingNewCategory(false); }}>Cancel</button>
              )}
            </div>
          </form>
        </div>

        {/* Right: Flat item list filtered by mmActiveCategory */}
        <div className="mm-inventory">
          {menuItems.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--color-text-muted)' }}>
              <Coffee size={48} opacity={0.2} />
              <p>No items yet. Add one from the form.</p>
            </div>
          ) : (
            dropdownCategories
              .filter(cat => mmActiveCategory === '' ? menuItems.some(m => m.category === cat) : cat === mmActiveCategory && menuItems.some(m => m.category === cat))
              .map(cat => (
              <div key={cat} className="card" style={{ padding: '1rem 1.25rem', marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-brand)' }}>{cat} Category</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>({menuItems.filter(m => m.category === cat).length})</span>
                </div>
                {menuItems.filter(m => m.category === cat).map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.6rem 0', borderBottom: '1px solid var(--color-surface-hover)' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', flexShrink: 0, backgroundColor: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Coffee size={18} color="var(--color-brand)" opacity={0.5} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {item.name}
                        {!hasTemp(item.category) && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', backgroundColor: '#f0f0f0', color: '#888' }}>No Temp</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{item.category}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-brand)', minWidth: 60, textAlign: 'right' }}>₱{item.price}</div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn-icon" onClick={() => editMenuItem(item)} title="Edit"><Edit size={15} /></button>
                      <button className="btn-icon" onClick={() => setItemToDelete(item)} title="Delete"><Trash2 size={15} className="text-danger" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {itemToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title text-danger">Delete Menu Item</h2>
            <div className="modal-body">
              <p style={{ fontSize: '1.05rem' }}>Are you sure you want to remove <strong>{itemToDelete.name}</strong> from your menu?</p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => setItemToDelete(null)}>Cancel</button>
              <button className="btn btn-danger w-full" onClick={confirmDeleteMenuItem}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {renamingCategory && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Rename Category</h2>
            <div className="modal-body">
              <p style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>Rename <strong>{renamingCategory}</strong> to:</p>
              <input className="form-control" value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && confirmRenameCategory()} />
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>All {menuItems.filter(m => m.category === renamingCategory).length} item(s) will be updated.</p>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => { setRenamingCategory(null); setRenameValue(''); }}>Cancel</button>
              <button className="btn btn-primary w-full" onClick={confirmRenameCategory}>Rename</button>
            </div>
          </div>
        </div>
      )}
      {categoryToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title text-danger">Delete Category</h2>
            <div className="modal-body">
              <p style={{ fontSize: '1.05rem' }}>Delete the <strong>{categoryToDelete}</strong> category?</p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                This will also permanently delete all <strong>{menuItems.filter(m => m.category === categoryToDelete).length} item(s)</strong> under this category. This cannot be undone.
              </p>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => setCategoryToDelete(null)}>Cancel</button>
              <button className="btn btn-danger w-full" onClick={confirmDeleteCategory}>Delete Category</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDailySales = () => {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);

    const overallOrders = orders.filter(o => {
      if (o.refunded) return false;
      if (overallMode === 'month') return parseISO(o.date) >= startOfCurrentMonth;
      return true;
    });
    const overallExpenses = expenses.filter(e => {
      if (overallMode === 'month') return parseISO(e.date) >= startOfCurrentMonth;
      return true;
    });
    const overallRevenue = overallOrders.reduce((s, o) => s + o.total, 0);
    const overallExpenseTotal = overallExpenses.reduce((s, e) => s + e.amount, 0);
    const overallNetProfit = overallRevenue - overallExpenseTotal;

    return (
    <div className="content-wrapper">
      <h2 className="title mb-4">Sales Summary</h2>

      {/* Overall Running Section */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--color-brand)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>Overall Performance</span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {['month', 'alltime'].map(m => (
              <button key={m} onClick={() => setOverallMode(m)} style={{ padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer', backgroundColor: overallMode === m ? 'var(--color-brand)' : 'var(--color-surface-hover)', color: overallMode === m ? '#fff' : 'var(--color-text)' }}>
                {m === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Total Revenue</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-brand)' }}>₱{overallRevenue.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Total Expenses</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-danger)' }}>-₱{overallExpenseTotal.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Net Profit</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: overallNetProfit >= 0 ? 'var(--color-brand)' : 'var(--color-danger)' }}>
              {overallNetProfit >= 0 ? '' : '-'}₱{Math.abs(overallNetProfit).toLocaleString()}
            </div>
            {overallNetProfit < 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: '0.2rem' }}>₱{Math.abs(overallNetProfit).toLocaleString()} still to recover</div>
            )}
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <span className="text-muted font-bold" style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>Select Date:</span>
        <input type="date" value={summaryFilterDate} onChange={e => setSummaryFilterDate(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
        {summaryFilterDate === format(new Date(), 'yyyy-MM-dd') ? (
          <span className="text-success font-bold" style={{ marginLeft: '0.5rem' }}>📅 Today</span>
        ) : (
          <button className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', backgroundColor: 'var(--color-bg)' }} onClick={() => setSummaryFilterDate(format(new Date(), 'yyyy-MM-dd'))}>
            Jump to Today
          </button>
        )}
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">Total Revenue</div>
          <div className="value">₱{summaryRevenue.toLocaleString()}</div>
        </div>
        <div className="summary-card">
          <div className="label">Items Sold</div>
          <div className="value" style={{ color: 'var(--color-text)' }}>{summaryItemsSold}</div>
        </div>
        <div className="summary-card">
          <div className="label">Processed Orders</div>
          <div className="value" style={{ color: 'var(--color-text)' }}>{summaryOrders.length}</div>
        </div>
        <div className="summary-card">
          <div className="label">Net Profit</div>
          <div className="value" style={{ color: summaryRevenue - summaryExpenses >= 0 ? 'var(--color-brand)' : 'var(--color-danger)' }}>₱{(summaryRevenue - summaryExpenses).toLocaleString()}</div>
        </div>
        <div className="summary-card">
          <div className="label">🏷️ Total Discounts</div>
          <div className="value" style={{ color: 'var(--color-danger)' }}>-₱{summaryOrders.filter(o => !o.refunded).reduce((s, o) => s + (o.discount_amount || 0), 0).toLocaleString()}</div>
        </div>
        <div className="summary-card">
          <div className="label">💵 Cash on Hand</div>
          <div className="value" style={{ color: 'var(--color-text)' }}>₱{summaryCashRevenue.toLocaleString()}</div>
        </div>
        <div className="summary-card">
          <div className="label">📱 GCash Balance</div>
          <div className="value" style={{ color: '#0070f3' }}>₱{summaryGCashRevenue.toLocaleString()}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 className="font-bold mb-4" style={{ fontSize: '1.2rem' }}>Transactions for {format(summaryDateObj, 'MMM. d, yyyy')}</h3>
        {summaryOrders.length === 0 ? (
          <p className="text-muted text-center py-4">No sales recorded for this date.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time of Order</th>
                  <th>Purchased Items</th>
                  <th className="text-center">Payment</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Order Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summaryOrders.map(order => (
                  <tr key={order.id} style={{ opacity: order.refunded ? 0.5 : 1 }}>
                    <td className="text-muted font-bold">{format(parseISO(order.date), 'h:mm a')}</td>
                    <td style={{ fontSize: '0.95rem' }}>{order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                    <td className="text-center">
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: order.payment_method === 'GCash' ? '#e0f0ff' : '#e8f5e9', color: order.payment_method === 'GCash' ? '#0070f3' : '#2e7d32' }}>
                        {order.payment_method === 'GCash' ? '📱' : '💵'} {order.payment_method || 'Cash'}
                      </span>
                      {!order.refunded && (
                        <button onClick={() => updatePaymentMethod(order, order.payment_method === 'GCash' ? 'Cash' : 'GCash')} style={{ display: 'block', margin: '0.25rem auto 0', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                          switch
                        </button>
                      )}
                    </td>
                    <td className="text-right" style={{ fontSize: '0.85rem' }}>
                      {order.discount_amount > 0
                        ? <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>-₱{order.discount_amount.toLocaleString()}</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td className="text-right font-bold text-brand">
                      {order.refunded ? <span style={{ color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 700 }}>REFUNDED</span> : (
                        <div>
                          {order.discount_amount > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>₱{(order.subtotal ?? order.total).toLocaleString()}</div>}
                          ₱{order.total.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="text-right" style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      {!order.refunded && <button className="btn-icon" onClick={() => setOrderToRefund(order)} title="Refund"><img src="/refund.png" alt="Refund" style={{ width: 20, height: 20 }} /></button>}
                      <button className="btn-icon" onClick={() => setOrderToDelete(order)} title="Delete"><Trash2 size={16} className="text-danger" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderSalesHistory = () => (
    <div className="content-wrapper">
      <h2 className="title mb-4">Historical Records</h2>

      <div className="filter-bar">
        <span className="text-muted font-bold" style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>Filter by Date:</span>
        <input type="date" value={historyFilterDate} onChange={e => setHistoryFilterDate(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
        {historyFilterDate && (
          <button className="btn" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', backgroundColor: 'var(--color-surface-hover)' }} onClick={() => setHistoryFilterDate('')}>
            Clear Filter (Show All)
          </button>
        )}
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        {filteredHistoryOrders.length === 0 ? (
          <p className="text-muted text-center py-4">No sales history found for the selected criteria.</p>
        ) : (
          <div className="table-container" style={{ maxHeight: '600px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Order Details</th>
                  <th className="text-center">Total Quantity</th>
                  <th className="text-center">Payment</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Revenue</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryOrders.map(order => {
                  const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
                  return (
                    <tr key={order.id} style={{ opacity: order.refunded ? 0.5 : 1 }}>
                      <td>
                        <div className="font-bold">{format(parseISO(order.date), 'MMM d, yyyy')}</div>
                        <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{format(parseISO(order.date), 'h:mm a')}</div>
                      </td>
                      <td>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.95rem' }}>
                          {order.items.map(i => (
                            <li key={i.id} style={{ marginBottom: '0.25rem' }}>
                              <span className="text-muted font-bold" style={{ marginRight: '0.5rem' }}>{i.qty}x</span>
                              {i.name}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="text-center font-bold">{totalItems}</td>
                      <td className="text-center">
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: order.payment_method === 'GCash' ? '#e0f0ff' : '#e8f5e9', color: order.payment_method === 'GCash' ? '#0070f3' : '#2e7d32' }}>
                          {order.payment_method === 'GCash' ? '📱' : '💵'} {order.payment_method || 'Cash'}
                        </span>
                        {!order.refunded && (
                          <button onClick={() => updatePaymentMethod(order, order.payment_method === 'GCash' ? 'Cash' : 'GCash')} style={{ display: 'block', margin: '0.25rem auto 0', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            switch
                          </button>
                        )}
                      </td>
                      <td className="text-right" style={{ fontSize: '0.85rem' }}>
                        {order.discount_amount > 0
                          ? <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>-₱{order.discount_amount.toLocaleString()}</span>
                          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="text-right font-bold text-brand" style={{ fontSize: '1.1rem' }}>
                        {order.refunded ? <span style={{ color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 700 }}>REFUNDED</span> : (
                          <div>
                            {order.discount_amount > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>₱{(order.subtotal ?? order.total).toLocaleString()}</div>}
                            ₱{order.total.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="text-right" style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        {!order.refunded && <button className="btn-icon" onClick={() => setOrderToRefund(order)} title="Refund"><img src="/refund.png" alt="Refund" style={{ width: 20, height: 20 }} /></button>}
                        <button className="btn-icon" onClick={() => setOrderToDelete(order)} title="Delete"><Trash2 size={16} className="text-danger" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // Chart Data
  // -------------------------------------------------------------
  const chartData = useMemo(() => {
    const activeOrders = orders.filter(o => !o.refunded);
    if (chartMode === 'weekly') {
      const days = eachDayOfInterval({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: new Date() });
      return days.map(day => ({
        label: format(day, 'EEE'),
        revenue: activeOrders.filter(o => isSameDay(parseISO(o.date), day)).reduce((s, o) => s + o.total, 0),
      }));
    } else {
      const weeks = eachWeekOfInterval({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }, { weekStartsOn: 1 });
      return weeks.map((weekStart, i) => ({
        label: `Wk ${i + 1}`,
        revenue: activeOrders.filter(o => {
          const d = parseISO(o.date);
          const wEnd = new Date(weekStart); wEnd.setDate(wEnd.getDate() + 6);
          return d >= weekStart && d <= wEnd;
        }).reduce((s, o) => s + o.total, 0),
      }));
    }
  }, [orders, chartMode]);

  const renderChart = () => (
    <div className="content-wrapper">
      <h2 className="title mb-4">Sales Chart</h2>
      <div className="card">
        <div className="flex gap-2 mb-4">
          <button className={`btn ${chartMode === 'weekly' ? 'btn-primary' : ''}`} style={chartMode !== 'weekly' ? { backgroundColor: 'var(--color-surface-hover)' } : {}} onClick={() => setChartMode('weekly')}>This Week</button>
          <button className={`btn ${chartMode === 'monthly' ? 'btn-primary' : ''}`} style={chartMode !== 'monthly' ? { backgroundColor: 'var(--color-surface-hover)' } : {}} onClick={() => setChartMode('monthly')}>This Month</button>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 13 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 13 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v.toLocaleString()}`} />
            <Tooltip formatter={v => [`₱${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }} />
            <Bar dataKey="revenue" fill="var(--color-brand)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const [bestSellerPeriod, setBestSellerPeriod] = useState('alltime');

  const renderBestSellers = () => {
    const now = new Date();
    const filteredOrders = orders.filter(o => {
      if (o.refunded) return false;
      const d = parseISO(o.date);
      if (bestSellerPeriod === 'today') return isSameDay(d, now);
      if (bestSellerPeriod === 'week') return d >= startOfWeek(now, { weekStartsOn: 1 });
      if (bestSellerPeriod === 'month') return d >= startOfMonth(now);
      return true;
    });
    const tally = {};
    filteredOrders.forEach(o => o.items.forEach(i => {
      tally[i.name] = (tally[i.name] || 0) + i.qty;
    }));
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] || 1;
    const periodLabels = { today: 'Today', week: 'This Week', month: 'This Month', alltime: 'All Time' };
    return (
      <div className="content-wrapper">
        <h2 className="title mb-4">Best Sellers</h2>
        <div className="flex gap-2 mb-4">
          {Object.entries(periodLabels).map(([key, label]) => (
            <button
              key={key}
              className="btn"
              style={{
                backgroundColor: bestSellerPeriod === key ? 'var(--color-brand)' : 'var(--color-surface-hover)',
                color: bestSellerPeriod === key ? '#fff' : 'var(--color-text)',
                fontWeight: 700,
              }}
              onClick={() => setBestSellerPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          {sorted.length === 0 ? (
            <p className="text-muted text-center py-4">No sales data for {periodLabels[bestSellerPeriod].toLowerCase()}.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sorted.map(([name, qty], i) => (
                <div key={name}>
                  <div className="flex justify-between items-center" style={{ marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      <span style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--color-text-muted)', marginRight: '0.5rem', fontWeight: 800 }}>#{i + 1}</span>
                      {name}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--color-brand)' }}>{qty} sold</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'var(--color-surface-hover)' }}>
                    <div style={{ height: '100%', borderRadius: '999px', width: `${(qty / max) * 100}%`, backgroundColor: i === 0 ? '#f59e0b' : 'var(--color-brand)', transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExpenses = () => (
    <div className="content-wrapper">
      <h2 className="title mb-4">Expense Tracker</h2>
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 className="font-bold mb-4" style={{ fontSize: '1.1rem' }}>Log Expense</h3>
        <form onSubmit={saveExpense} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input className="form-control" style={{ flex: 2, minWidth: '160px' }} placeholder="Description (e.g. Coffee beans)" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
          <input className="form-control" style={{ flex: 1, minWidth: '120px' }} type="number" placeholder="Amount (₱)" min="1" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      </div>
      <div className="card" style={{ padding: '1.5rem' }}>
        {expenses.length === 0 ? (
          <p className="text-muted text-center py-4">No expenses logged yet.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td className="text-muted font-bold" style={{ fontSize: '0.9rem' }}>{format(parseISO(e.date), 'MMM d, yyyy h:mm a')}</td>
                    <td>{e.description}</td>
                    <td className="text-right font-bold text-danger">₱{e.amount.toLocaleString()}</td>
                    <td className="text-right"><button className="btn-icon" onClick={() => setExpenseToDelete(e)}><Trash2 size={16} className="text-danger" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {expenseToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title text-danger">Delete Expense</h2>
            <div className="modal-body">
              <p>Delete <strong>{expenseToDelete.description}</strong> — ₱{expenseToDelete.amount.toLocaleString()}?</p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>This cannot be undone.</p>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => setExpenseToDelete(null)}>Cancel</button>
              <button className="btn btn-danger w-full" onClick={deleteExpense}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const SIDEBAR_ITEMS = [
    { id: 'pos', icon: <LayoutGrid size={20} />, label: 'POS / Order' },
    { id: 'menu', icon: <Coffee size={20} />, label: 'Menu Management' },
    { id: 'daily', icon: <BarChart3 size={20} />, label: 'Sales Summary' },
    { id: 'history', icon: <History size={20} />, label: 'Historical Records' },
    { id: 'chart', icon: <TrendingUp size={20} />, label: 'Sales Chart' },
    { id: 'bestsellers', icon: <Award size={20} />, label: 'Best Sellers' },
    { id: 'expenses', icon: <Wallet size={20} />, label: 'Expenses' },
  ];

  if (loading) return (
    <div className="login-overlay">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--color-brand)' }}>
        <Coffee size={48} />
        <p className="font-bold" style={{ fontSize: '1.1rem' }}>Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <button className="mobile-nav-toggle" onClick={() => setIsMobileMenuOpen(true)}>
        <MenuIcon size={24} color="var(--color-brand)" />
      </button>

      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="logo-container">
          <Coffee size={32} color="var(--color-brand)" />
          <span className="title">Kape Sa<br />Garahe POS</span>
          {isMobileMenuOpen && (
            <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setIsMobileMenuOpen(false)}>
              <X size={24} />
            </button>
          )}
        </div>

        <nav className="nav-menu">
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => { setCurrentView(item.id); setIsMobileMenuOpen(false); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="nav-item" onClick={() => setDarkMode(d => !d)} style={{ color: 'var(--color-text-muted)' }}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />} {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button className="nav-item" style={{ color: 'var(--color-danger)' }} onClick={onLogout}>
            <X size={20} /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        {currentView === 'pos' && renderPOS()}
        {currentView === 'menu' && renderMenuManagement()}
        {currentView === 'daily' && renderDailySales()}
        {currentView === 'history' && renderSalesHistory()}
        {currentView === 'chart' && renderChart()}
        {currentView === 'bestsellers' && renderBestSellers()}
        {currentView === 'expenses' && renderExpenses()}
      </main>

      {orderToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title text-danger">Delete Order</h2>
            <div className="modal-body">
              <p style={{ fontSize: '1.05rem' }}>Are you sure you want to delete this order?</p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                {format(parseISO(orderToDelete.date), 'MMM d, yyyy h:mm a')} — ₱{orderToDelete.total.toLocaleString()}
              </p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => setOrderToDelete(null)}>Cancel</button>
              <button className="btn btn-danger w-full" onClick={deleteOrder}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {orderToRefund && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title" style={{ color: '#f59e0b' }}>Refund Order</h2>
            <div className="modal-body">
              <p style={{ fontSize: '1.05rem' }}>Mark this order as refunded?</p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                {format(parseISO(orderToRefund.date), 'MMM d, yyyy h:mm a')} — ₱{orderToRefund.total.toLocaleString()}
              </p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>The order stays in history but is excluded from revenue.</p>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => setOrderToRefund(null)}>Cancel</button>
              <button className="btn w-full" style={{ backgroundColor: '#f59e0b', color: '#fff', fontWeight: 700 }} onClick={confirmRefund}>Confirm Refund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem('kape_loggedin') === 'true');

  const handleEnter = () => {
    localStorage.setItem('kape_loggedin', 'true');
    setLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('kape_loggedin');
    setLoggedIn(false);
  };

  return loggedIn ? <POSApp onLogout={handleLogout} /> : <LoginPage onEnter={handleEnter} />;
}
