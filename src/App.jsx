import React, { useState, useMemo } from 'react';
import { 
  Coffee, Menu as MenuIcon, X, LayoutGrid, BarChart3, 
  History, Plus, Minus, Trash2, Edit, CheckCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isSameDay } from 'date-fns';
import './index.css';

// Default categories
const DEFAULT_CATEGORIES = ['Coffee', 'Non-Coffee', 'Pastry', 'Other'];

// Custom Hook for LocalStorage
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

export default function App() {
  const [menuItems, setMenuItems] = useLocalStorage('pos_menu_items', [
    { id: uuidv4(), name: 'Americano', price: 90, category: 'Coffee' },
    { id: uuidv4(), name: 'Latte', price: 110, category: 'Coffee' },
    { id: uuidv4(), name: 'Matcha Latte', price: 120, category: 'Non-Coffee' },
    { id: uuidv4(), name: 'Croissant', price: 80, category: 'Pastry' }
  ]);
  const [orders, setOrders] = useLocalStorage('pos_orders_history', []);
  const [cart, setCart] = useState([]);
  const [currentView, setCurrentView] = useState('pos'); // pos, menu, daily, history
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // POS State
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Menu Management State
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: '', price: '', category: 'Coffee' });
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Filters State
  const [historyFilterDate, setHistoryFilterDate] = useState('');
  const [summaryFilterDate, setSummaryFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // -------------------------------------------------------------
  // Derived Data
  // -------------------------------------------------------------
  const categories = ['All', ...Array.from(new Set([...DEFAULT_CATEGORIES, ...menuItems.map(m => m.category)]))];
  const dropdownCategories = categories.filter(c => c !== 'All');

  // Summary Logic
  const summaryDateObj = useMemo(() => summaryFilterDate ? parseISO(summaryFilterDate) : new Date(), [summaryFilterDate]);
  const summaryOrders = useMemo(() => orders.filter(o => isSameDay(parseISO(o.date), summaryDateObj)), [orders, summaryDateObj]);
  
  const summaryRevenue = summaryOrders.reduce((sum, order) => sum + order.total, 0);
  const summaryItemsSold = summaryOrders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0);
  }, 0);

  // History Logic
  const filteredHistoryOrders = useMemo(() => {
    if (!historyFilterDate) return orders;
    const filterDateObj = parseISO(historyFilterDate);
    return orders.filter(o => isSameDay(parseISO(o.date), filterDateObj));
  }, [orders, historyFilterDate]);

  // Cart
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const filteredMenuItems = activeCategory === 'All' 
    ? menuItems 
    : menuItems.filter(m => m.category === activeCategory);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : item;
        }
        return item;
      }).filter(item => item.qty > 0);
    });
  };

  const confirmCheckout = () => {
    if (cart.length === 0) return;
    
    const newOrder = {
      id: uuidv4(),
      date: new Date().toISOString(),
      items: [...cart],
      total: cartTotal
    };

    setOrders([newOrder, ...orders]);
    setCart([]);
    setShowCheckoutModal(false);
  };

  const saveMenuItem = (e) => {
    e.preventDefault();
    if (!menuForm.name || !menuForm.price || !menuForm.category) return;

    if (editingMenuId) {
      setMenuItems(prev => prev.map(m => m.id === editingMenuId ? { 
        ...m, 
        name: menuForm.name, 
        price: parseFloat(menuForm.price), 
        category: menuForm.category 
      } : m));
      setEditingMenuId(null);
    } else {
      setMenuItems([...menuItems, {
        id: uuidv4(),
        name: menuForm.name,
        price: parseFloat(menuForm.price),
        category: menuForm.category
      }]);
    }
    setMenuForm({ name: '', price: '', category: dropdownCategories[0] });
    setIsAddingNewCategory(false);
  };

  const editMenuItem = (item) => {
    setMenuForm({ name: item.name, price: item.price, category: item.category });
    setIsAddingNewCategory(false);
    setEditingMenuId(item.id);
  };

  const requestDeleteMenuItem = (item) => {
    setItemToDelete(item);
  };

  const confirmDeleteMenuItem = () => {
    if (itemToDelete) {
      setMenuItems(prev => prev.filter(m => m.id !== itemToDelete.id));
      setItemToDelete(null);
    }
  };

  // -------------------------------------------------------------
  // Views
  // -------------------------------------------------------------
  const renderPOS = () => (
    <div className="pos-layout">
      {/* Menu Area */}
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
            )
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

      {/* Cart Area */}
      <div className="pos-cart-area">
        <div className="cart-header">
          <h2 className="title" style={{fontSize: '1.25rem', margin: 0}}>Current Order</h2>
        </div>
        
        <div className="cart-items">
          {cart.length === 0 ? (
            <p className="text-muted text-center py-8" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
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
                  <button className="cart-qty-btn" onClick={() => updateCartQty(item.id, -1)}><Minus size={14}/></button>
                  <span className="cart-qty">{item.qty}</span>
                  <button className="cart-qty-btn" onClick={() => addToCart(item)}><Plus size={14}/></button>
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

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Confirm Payment</h2>
            <div className="modal-body">
              <p style={{fontSize: '1.05rem', marginBottom: '1.5rem'}}>Please confirm the total amount to collect from the customer.</p>
              
              <div className="flex justify-between items-center" style={{paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-surface-hover)', marginBottom: '0.75rem'}}>
                <span style={{fontWeight: 600}}>Total Items:</span>
                <span className="text-muted font-bold">{cart.reduce((s, i) => s + i.qty, 0)} items</span>
              </div>
              
              <div className="flex justify-between items-center" style={{paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-surface-hover)'}}>
                <span style={{fontWeight: 600}}>Total Due:</span>
                <span className="text-brand" style={{fontSize: '1.5rem', fontWeight: 800}}>₱{cartTotal.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{backgroundColor: 'var(--color-bg)', color: 'var(--color-text)'}} onClick={() => setShowCheckoutModal(false)}>
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
      
      <div className="card">
        <h3 className="font-bold mb-4" style={{fontSize: '1.2rem', color: 'var(--color-brand)'}}>
          {editingMenuId ? 'Edit Menu Item' : 'Add New Item'}
        </h3>
        <form onSubmit={saveMenuItem} className="flex flex-col gap-4" style={{maxWidth: '500px'}}>
          <div>
            <label className="form-label">Item Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={menuForm.name} 
              onChange={e => setMenuForm({...menuForm, name: e.target.value})} 
              placeholder="e.g. Mocha Frappe"
              required 
            />
          </div>
          <div>
            <label className="form-label">Price (₱)</label>
            <input 
              type="number" 
              className="form-control" 
              value={menuForm.price} 
              onChange={e => setMenuForm({...menuForm, price: e.target.value})} 
              placeholder="0.00"
              min="0"
              required 
            />
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
                    setMenuForm({...menuForm, category: ''});
                  } else {
                    setMenuForm({...menuForm, category: e.target.value});
                  }
                }}
                required
              >
                <option value="" disabled>Select a category</option>
                {dropdownCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="ADD_NEW" style={{fontWeight: 'bold', color: 'var(--color-brand)'}}>+ Add new category...</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="form-control" 
                  value={menuForm.category} 
                  onChange={e => setMenuForm({...menuForm, category: e.target.value})} 
                  placeholder="Type new category..."
                  required 
                  autoFocus
                />
                <button 
                  type="button" 
                  className="btn" 
                  style={{backgroundColor: 'var(--color-surface-hover)', padding: '0.75rem 1rem'}} 
                  onClick={() => { setIsAddingNewCategory(false); setMenuForm({...menuForm, category: dropdownCategories[0] || 'Coffee'}) }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mt-2">
            <button type="submit" className="btn btn-primary flex-1">
              {editingMenuId ? 'Update Menu Item' : 'Save Item'}
            </button>
            {editingMenuId && (
              <button 
                type="button" 
                className="btn" 
                style={{backgroundColor: 'var(--color-surface-hover)'}} 
                onClick={() => { setEditingMenuId(null); setMenuForm({name:'', price:'', category:dropdownCategories[0]}); setIsAddingNewCategory(false); }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="font-bold mb-4" style={{fontSize: '1.2rem', color: 'var(--color-text)'}}>Current Menu Inventory</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Menu Item Name</th>
                <th>Category Tag</th>
                <th>Price</th>
                <th className="text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map(item => (
                <tr key={item.id}>
                  <td className="font-bold" style={{color: 'var(--color-text)'}}>{item.name}</td>
                  <td>
                    <span className="category-pill" style={{padding: '0.35rem 0.85rem', fontSize: '0.85rem', minWidth: 'auto', display: 'inline-flex', borderRadius: '12px'}}>
                      {item.category}
                    </span>
                  </td>
                  <td className="text-brand font-bold">₱{item.price}</td>
                  <td className="text-right">
                    <button className="btn-icon" onClick={() => editMenuItem(item)} title="Edit"><Edit size={16}/></button>
                    <button className="btn-icon" onClick={() => requestDeleteMenuItem(item)} title="Delete"><Trash2 size={16} className="text-danger"/></button>
                  </td>
                </tr>
              ))}
              {menuItems.length === 0 && (
                <tr><td colSpan="4" className="text-center py-4 text-muted">No items in menu. Add one above!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title text-danger">Delete Menu Item</h2>
            <div className="modal-body">
              <p style={{fontSize: '1.05rem'}}>Are you sure you want to remove <strong>{itemToDelete.name}</strong> from your menu?</p>
              <p className="text-muted" style={{fontSize: '0.9rem', marginTop: '0.5rem'}}>This action cannot be undone.</p>
            </div>
            <div className="modal-actions flex gap-2">
              <button className="btn w-full" style={{backgroundColor: 'var(--color-bg)', color: 'var(--color-text)'}} onClick={() => setItemToDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger w-full" onClick={confirmDeleteMenuItem}>
                Delete
              </button>
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
        <span className="text-muted font-bold" style={{textTransform: 'uppercase', fontSize: '0.85rem'}}>Select Date:</span>
        <input 
          type="date" 
          value={summaryFilterDate} 
          onChange={e => setSummaryFilterDate(e.target.value)} 
          max={format(new Date(), 'yyyy-MM-dd')}
        />
        {summaryFilterDate === format(new Date(), 'yyyy-MM-dd') ? (
            <span className="text-success font-bold" style={{marginLeft: '0.5rem'}}>📅 Today</span>
        ) : (
            <button className="btn" style={{padding: '0.5rem 1rem', fontSize: '0.9rem', backgroundColor: 'var(--color-bg)'}} onClick={() => setSummaryFilterDate(format(new Date(), 'yyyy-MM-dd'))}>
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
          <div className="value" style={{color: 'var(--color-text)'}}>{summaryItemsSold}</div>
        </div>
        <div className="summary-card">
          <div className="label">Processed Orders</div>
          <div className="value" style={{color: 'var(--color-text)'}}>{summaryOrders.length}</div>
        </div>
      </div>

      <div className="card" style={{padding: '1.5rem'}}>
        <h3 className="font-bold mb-4" style={{fontSize: '1.2rem'}}>Transactions for {format(summaryDateObj, 'MMM. d, yyyy')}</h3>
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
                </tr>
              </thead>
              <tbody>
                {summaryOrders.map(order => (
                  <tr key={order.id}>
                    <td className="text-muted font-bold">{format(parseISO(order.date), 'h:mm a')}</td>
                    <td style={{fontSize: '0.95rem'}}>
                      {order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                    </td>
                    <td className="text-right font-bold text-brand">₱{order.total.toLocaleString()}</td>
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
        <span className="text-muted font-bold" style={{textTransform: 'uppercase', fontSize: '0.85rem'}}>Filter by Date:</span>
        <input 
          type="date" 
          value={historyFilterDate} 
          onChange={e => setHistoryFilterDate(e.target.value)} 
          max={format(new Date(), 'yyyy-MM-dd')}
        />
        {historyFilterDate && (
          <button className="btn" style={{padding: '0.5rem 1rem', fontSize: '0.9rem', backgroundColor: 'var(--color-surface-hover)'}} onClick={() => setHistoryFilterDate('')}>
            Clear Filter (Show All)
          </button>
        )}
      </div>

      <div className="card" style={{padding: '1.5rem'}}>
        {filteredHistoryOrders.length === 0 ? (
          <p className="text-muted text-center py-4">No sales history found for the selected criteria.</p>
        ) : (
          <div className="table-container" style={{maxHeight: '600px'}}>
             <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Order Details</th>
                  <th className="text-center">Total Quantity</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryOrders.map(order => {
                  const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
                  return (
                    <tr key={order.id}>
                      <td>
                        <div className="font-bold text-text">{format(parseISO(order.date), 'MMM d, yyyy')}</div>
                        <div className="text-muted" style={{fontSize: '0.85rem', marginTop: '0.25rem'}}>{format(parseISO(order.date), 'h:mm a')}</div>
                      </td>
                      <td>
                        <ul style={{listStyle: 'none', padding: 0, margin: 0, fontSize: '0.95rem', color: 'var(--color-text)'}}>
                          {order.items.map(i => (
                            <li key={i.id} style={{marginBottom: '0.25rem'}}>
                              <span className="text-muted font-bold" style={{marginRight: '0.5rem'}}>{i.qty}x</span> 
                              {i.name}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="text-center font-bold">{totalItems}</td>
                      <td className="text-right font-bold text-brand" style={{fontSize: '1.1rem'}}>₱{order.total.toLocaleString()}</td>
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
  // Sidebar
  // -------------------------------------------------------------
  const SIDEBAR_ITEMS = [
    { id: 'pos', icon: <LayoutGrid size={20} />, label: 'POS / Order' },
    { id: 'menu', icon: <Coffee size={20} />, label: 'Menu Management' },
    { id: 'daily', icon: <BarChart3 size={20} />, label: 'Sales Summary' },
    { id: 'history', icon: <History size={20} />, label: 'Historical Records' },
  ];

  return (
    <div className="app-container">
      {/* Mobile Toggle */}
      <button className="mobile-nav-toggle" onClick={() => setIsMobileMenuOpen(true)}>
        <MenuIcon size={24} color="var(--color-brand)" />
      </button>

      {/* Left Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="logo-container">
          <Coffee size={32} color="var(--color-brand)" />
          <span className="title">Kapee Sa<br/>Garahe POS</span>
          {isMobileMenuOpen && (
             <button className="btn-icon" style={{marginLeft: 'auto'}} onClick={() => setIsMobileMenuOpen(false)}>
               <X size={24} />
             </button>
          )}
        </div>
        
        <nav className="nav-menu">
          {SIDEBAR_ITEMS.map(item => (
            <button 
              key={item.id} 
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentView(item.id);
                setIsMobileMenuOpen(false);
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Container */}
      <main className="main-content">
        {currentView === 'pos' && renderPOS()}
        {currentView === 'menu' && renderMenuManagement()}
        {currentView === 'daily' && renderDailySales()}
        {currentView === 'history' && renderSalesHistory()}
      </main>
    </div>
  );
}
