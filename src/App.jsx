import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Coffee, Menu as MenuIcon, X, LayoutGrid, BarChart3,
  History, Plus, Minus, Trash2, Edit, CheckCircle, TrendingUp
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

  // Menu Management State
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: 'Coffee' });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // Filters State
  const [historyFilterDate, setHistoryFilterDate] = useState('');
  const [summaryFilterDate, setSummaryFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Chart State
  const [chartMode, setChartMode] = useState('weekly');

  // -------------------------------------------------------------
  // Supabase Fetch
  // -------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: menuData }, { data: ordersData }] = await Promise.all([
      supabase.from('menu_items').select('*').order('name'),
      supabase.from('orders').select('*').order('date', { ascending: false }),
    ]);
    if (menuData) setMenuItems(menuData);
    if (ordersData) setOrders(ordersData);
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
  const summaryRevenue = summaryOrders.reduce((sum, o) => sum + o.total, 0);
  const summaryItemsSold = summaryOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);

  const filteredHistoryOrders = useMemo(() => {
    if (!historyFilterDate) return orders;
    const filterDateObj = parseISO(historyFilterDate);
    return orders.filter(o => isSameDay(parseISO(o.date), filterDateObj));
  }, [orders, historyFilterDate]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const filteredMenuItems = activeCategory === 'All' ? menuItems : menuItems.filter(m => m.category === activeCategory);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev =>
      prev.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item)
         .filter(item => item.qty > 0)
    );
  };

  const confirmCheckout = async () => {
    if (cart.length === 0) return;
    const newOrder = {
      id: uuidv4(),
      date: new Date().toISOString(),
      items: cart,
      total: cartTotal,
    };
    const { error } = await supabase.from('orders').insert([newOrder]);
    if (!error) {
      setOrders(prev => [newOrder, ...prev]);
      setCart([]);
      setShowCheckoutModal(false);
    }
  };

  const saveMenuItem = async (e) => {
    e.preventDefault();
    if (!menuForm.name || !menuForm.price || !menuForm.category) return;
    const price = parseFloat(menuForm.price);

    if (editingMenuId) {
      const { error } = await supabase.from('menu_items')
        .update({ name: menuForm.name, price, category: menuForm.category })
        .eq('id', editingMenuId);
      if (!error) {
        setMenuItems(prev => prev.map(m => m.id === editingMenuId ? { ...m, name: menuForm.name, price, category: menuForm.category } : m));
        setEditingMenuId(null);
      }
    } else {
      const newItem = { id: uuidv4(), name: menuForm.name, price, category: menuForm.category };
      const { error } = await supabase.from('menu_items').insert([newItem]);
      if (error) { alert('Error saving item: ' + error.message); return; }
      setMenuItems(prev => [...prev, newItem]);
    }
    setMenuForm({ name: '', price: '', category: dropdownCategories[0] || 'Coffee' });
    setIsAddingNewCategory(false);
  };

  const editMenuItem = (item) => {
    setMenuForm({ name: item.name, price: item.price, category: item.category });
    setIsAddingNewCategory(false);
    setEditingMenuId(item.id);
  };

  const [orderToDelete, setOrderToDelete] = useState(null);

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
      setCategoryToDelete(null);
    }
  };

  // -------------------------------------------------------------
  // Views
  // -------------------------------------------------------------
  const renderPOS = () => (
    <div className="pos-layout">
      <div className="pos-menu-area">
        <div className="category-filters">
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

        {filteredMenuItems.length === 0 ? (
          <p className="text-muted text-center py-8">No menu items found in this category.</p>
        ) : (
          <div className="menu-grid">
            {filteredMenuItems.map(item => {
              const qtyInCart = cart.find(i => i.id === item.id)?.qty || 0;
              return (
                <div key={item.id} className="menu-item-card" onClick={() => addToCart(item)}>
                  {qtyInCart > 0 && <div className="menu-item-badge">{qtyInCart}</div>}
                  <div className="menu-item-placeholder">
                    <Coffee size={64} opacity={0.2} />
                  </div>
                  <div className="menu-item-details">
                    <div>
                      <div className="menu-item-name">{item.name}</div>
                      <div className="menu-item-price">₱{item.price}</div>
                    </div>
                    <button className={`menu-add-btn ${qtyInCart > 0 ? 'active' : ''}`}>
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
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
            cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-image-placeholder">
                  <Coffee size={24} />
                </div>
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">₱{item.price} x {item.qty}</div>
                </div>
                <div className="cart-item-controls">
                  <button className="cart-qty-btn" onClick={() => updateCartQty(item.id, -1)}><Minus size={14} /></button>
                  <span className="cart-qty">{item.qty}</span>
                  <button className="cart-qty-btn" onClick={() => addToCart(item)}><Plus size={14} /></button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-footer">
          <div className="cart-total-row">
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
              <div className="flex justify-between items-center" style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-surface-hover)' }}>
                <span style={{ fontWeight: 600 }}>Total Due:</span>
                <span className="text-brand" style={{ fontSize: '1.5rem', fontWeight: 800 }}>₱{cartTotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => setShowCheckoutModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary w-full" onClick={confirmCheckout}>
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMenuManagement = () => (
    <div className="content-wrapper">
      <h2 className="title mb-4">Menu Management</h2>

      {/* Category Pills */}
      <div className="mm-category-pills">
        {dropdownCategories.map(cat => (
          <div key={cat} className="mm-category-pill">
            <span>{cat}</span>
            <span className="mm-category-count">{menuItems.filter(m => m.category === cat).length}</span>
            <button className="mm-category-delete" onClick={() => setCategoryToDelete(cat)} title="Delete category">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="mm-layout">

        {/* Left: Form */}
        <div className="card mm-form-card">
          <h3 className="font-bold mb-4" style={{ fontSize: '1.1rem', color: editingMenuId ? 'var(--color-brand)' : 'var(--color-text)' }}>
            {editingMenuId ? '✏️ Editing Item' : '➕ Add New Item'}
          </h3>
          <form onSubmit={saveMenuItem} className="flex flex-col gap-4">
            <div>
              <label className="form-label">Item Name</label>
              <input type="text" className="form-control" value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="e.g. Mocha Frappe" required />
            </div>
            <div>
              <label className="form-label">Price (₱)</label>
              <input type="number" className="form-control" value={menuForm.price} onChange={e => setMenuForm({ ...menuForm, price: e.target.value })} placeholder="0.00" min="1" required />
            </div>
            <div>
              <label className="form-label">Category</label>
              {!isAddingNewCategory ? (
                <select
                  className="form-control"
                  value={menuForm.category}
                  onChange={e => {
                    if (e.target.value === 'ADD_NEW') {
                      setIsAddingNewCategory(true);
                      setMenuForm({ ...menuForm, category: '' });
                    } else {
                      setMenuForm({ ...menuForm, category: e.target.value });
                    }
                  }}
                  required
                >
                  <option value="" disabled>Select a category</option>
                  {dropdownCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--color-brand)' }}>+ Add new category...</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input type="text" className="form-control" value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} placeholder="Type new category..." required autoFocus />
                  <button type="button" className="btn" style={{ backgroundColor: 'var(--color-surface-hover)', padding: '0.75rem 1rem' }} onClick={() => { setIsAddingNewCategory(false); setMenuForm({ ...menuForm, category: dropdownCategories[0] || 'Coffee' }); }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary flex-1">
                {editingMenuId ? 'Update Item' : 'Save Item'}
              </button>
              {editingMenuId && (
                <button type="button" className="btn" style={{ backgroundColor: 'var(--color-surface-hover)' }} onClick={() => { setEditingMenuId(null); setMenuForm({ name: '', price: '', category: dropdownCategories[0] || 'Coffee' }); setIsAddingNewCategory(false); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right: Inventory grouped by category */}
        <div className="mm-inventory">
          {menuItems.length === 0 ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem' }}>
              <Coffee size={48} opacity={0.2} />
              <p className="text-muted text-center">No items yet. Add one from the form.</p>
            </div>
          ) : (
            dropdownCategories.filter(cat => menuItems.some(m => m.category === cat)).map(cat => (
              <div key={cat} className="card mm-group-card">
                <div className="mm-group-header">
                  <span className="mm-group-title">{cat}</span>
                  <span className="mm-group-count">{menuItems.filter(m => m.category === cat).length} items</span>
                </div>
                <div className="mm-item-list">
                  {menuItems.filter(m => m.category === cat).map(item => (
                    <div key={item.id} className="mm-item-row">
                      <div className="mm-item-icon"><Coffee size={18} /></div>
                      <div className="mm-item-info">
                        <span className="mm-item-name">{item.name}</span>
                        <span className="mm-item-price">₱{item.price}</span>
                      </div>
                      <div className="flex gap-1">
                        <button className="btn-icon" onClick={() => editMenuItem(item)} title="Edit"><Edit size={15} /></button>
                        <button className="btn-icon" onClick={() => setItemToDelete(item)} title="Delete"><Trash2 size={15} className="text-danger" /></button>
                      </div>
                    </div>
                  ))}
                </div>
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
      {categoryToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title text-danger">Delete Category</h2>
            <div className="modal-body">
              <p style={{ fontSize: '1.05rem' }}>Are you sure you want to delete <strong>{categoryToDelete}</strong>?</p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                This will also delete all <strong>{menuItems.filter(m => m.category === categoryToDelete).length} item(s)</strong> under this category. This cannot be undone.
              </p>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }} onClick={() => setCategoryToDelete(null)}>Cancel</button>
              <button className="btn btn-danger w-full" onClick={confirmDeleteCategory}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDailySales = () => (
    <div className="content-wrapper">
      <h2 className="title mb-4">Sales Summary</h2>

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
                  <th className="text-right">Order Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summaryOrders.map(order => (
                  <tr key={order.id}>
                    <td className="text-muted font-bold">{format(parseISO(order.date), 'h:mm a')}</td>
                    <td style={{ fontSize: '0.95rem' }}>{order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                    <td className="text-right font-bold text-brand">₱{order.total.toLocaleString()}</td>
                    <td className="text-right">
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
                  <th className="text-right">Revenue</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryOrders.map(order => {
                  const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
                  return (
                    <tr key={order.id}>
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
                      <td className="text-right font-bold text-brand" style={{ fontSize: '1.1rem' }}>₱{order.total.toLocaleString()}</td>
                      <td className="text-right">
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
    if (chartMode === 'weekly') {
      const days = eachDayOfInterval({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: new Date() });
      return days.map(day => ({
        label: format(day, 'EEE'),
        revenue: orders.filter(o => isSameDay(parseISO(o.date), day)).reduce((s, o) => s + o.total, 0),
      }));
    } else {
      const weeks = eachWeekOfInterval({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }, { weekStartsOn: 1 });
      return weeks.map((weekStart, i) => ({
        label: `Wk ${i + 1}`,
        revenue: orders.filter(o => {
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

  const SIDEBAR_ITEMS = [
    { id: 'pos', icon: <LayoutGrid size={20} />, label: 'POS / Order' },
    { id: 'menu', icon: <Coffee size={20} />, label: 'Menu Management' },
    { id: 'daily', icon: <BarChart3 size={20} />, label: 'Sales Summary' },
    { id: 'history', icon: <History size={20} />, label: 'Historical Records' },
    { id: 'chart', icon: <TrendingUp size={20} />, label: 'Sales Chart' },
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

        <button className="nav-item" style={{ color: 'var(--color-danger)', marginTop: 'auto' }} onClick={onLogout}>
          <X size={20} /> Logout
        </button>
      </aside>

      <main className="main-content">
        {currentView === 'pos' && renderPOS()}
        {currentView === 'menu' && renderMenuManagement()}
        {currentView === 'daily' && renderDailySales()}
        {currentView === 'history' && renderSalesHistory()}
        {currentView === 'chart' && renderChart()}
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
