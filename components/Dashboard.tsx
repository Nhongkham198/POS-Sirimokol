
import React, { useMemo, useState, useRef } from 'react';
import type { CompletedOrder, CancelledOrder, User } from '../types';
import { SalesChart } from './SalesChart';
import PieChart from './PieChart';

interface DashboardProps {
    completedOrders: CompletedOrder[];
    cancelledOrders: CancelledOrder[];
    openingTime: string;
    closingTime: string;
    currentUser: User | null;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className={`p-6 bg-white rounded-xl shadow-md flex items-center gap-6 border-l-4 ${color}`}>
        <div className="text-4xl">{icon}</div>
        <div>
            <p className="text-base text-gray-500 font-medium">{title}</p>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ completedOrders, cancelledOrders, openingTime, closingTime, currentUser }) => {
    // Initialize with today's date
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const dateInputRef = useRef<HTMLInputElement>(null);
    
    // NEW: State for Category Filtering
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
    // NEW: State for Order Type Filtering (LineMan, Dine-in, Takeaway)
    const [selectedOrderTypeFilter, setSelectedOrderTypeFilter] = useState<string | null>(null);
    // NEW: State for Hourly Traffic Drill-down
    const [selectedHourFilter, setSelectedHourFilter] = useState<number | null>(null);

    // Check permissions for monthly view
    const canViewMonthly = useMemo(() => {
        if (!currentUser) return false;
        return ['admin', 'branch-admin', 'auditor'].includes(currentUser.role);
    }, [currentUser]);

    // Helper to format date based on view mode (using local time)
    const dateInputValue = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        
        if (viewMode === 'monthly') {
            return `${year}-${month}`;
        }
        
        const day = String(selectedDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, [selectedDate, viewMode]);

    // Helper to extract provider name from delivery orders
    const getDeliveryProviderName = (order: { orderType: string, customerName?: string }) => {
        if (order.orderType !== 'lineman') return null;
        if (order.customerName && order.customerName.includes('#')) {
            // Assumes format "Provider #123"
            return order.customerName.split('#')[0].trim();
        }
        return order.customerName || 'Delivery'; // Default fallback
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            if (viewMode === 'monthly') {
                const [year, month] = e.target.value.split('-').map(Number);
                // Set to the 1st of the selected month
                setSelectedDate(new Date(year, month - 1, 1));
            } else {
                const [year, month, day] = e.target.value.split('-').map(Number);
                setSelectedDate(new Date(year, month - 1, day));
            }
            // Reset filters on date change
            setSelectedHourFilter(null);
        }
    };

    const handleViewModeChange = (mode: 'daily' | 'monthly') => {
        setViewMode(mode);
        setSelectedHourFilter(null);
    };

    const handleCategoryClick = (category: string) => {
        // Toggle: Click again to clear
        if (selectedCategoryFilter === category) {
            setSelectedCategoryFilter(null);
        } else {
            setSelectedCategoryFilter(category);
        }
    };

    const handleOrderTypeClick = (typeLabel: string) => {
        // Toggle
        if (selectedOrderTypeFilter === typeLabel) {
            setSelectedOrderTypeFilter(null);
        } else {
            setSelectedOrderTypeFilter(typeLabel);
        }
    };

    const handleClearFilter = () => {
        setSelectedCategoryFilter(null);
        setSelectedOrderTypeFilter(null);
        setSelectedHourFilter(null);
    };

    // Filter orders based on the selected local date/month AND role visibility AND filters (Type/Category logic moved to charts mostly)
    const filteredCompletedOrders = useMemo(() => {
        let orders = completedOrders;
        
        // Soft delete logic: hide deleted items for non-admins
        if (currentUser?.role !== 'admin') {
            orders = orders.filter(o => !o.isDeleted);
        }

        return orders.filter(order => {
            const orderDate = new Date(order.completionTime);
            let matchesDate = false;
            
            if (viewMode === 'monthly') {
                matchesDate = orderDate.getMonth() === selectedDate.getMonth() &&
                              orderDate.getFullYear() === selectedDate.getFullYear();
            } else {
                matchesDate = orderDate.getDate() === selectedDate.getDate() &&
                              orderDate.getMonth() === selectedDate.getMonth() &&
                              orderDate.getFullYear() === selectedDate.getFullYear();
            }

            if (!matchesDate) return false;

            // Apply Order Type Filter (LineMan/Takeaway/Dine-in) with Provider Support
            if (selectedOrderTypeFilter) {
                const isDelivery = order.orderType === 'lineman';
                const isTakeawayOrder = order.orderType === 'takeaway';
                // Check if any item is takeaway (hybrid order)
                const hasTakeawayItems = order.items.some(i => i.isTakeaway);

                if (selectedOrderTypeFilter === 'กลับบ้าน') {
                    // Include if order is strictly takeaway OR has takeaway items
                    if (!isTakeawayOrder && !hasTakeawayItems) return false;
                } else if (selectedOrderTypeFilter === 'ทานที่ร้าน') {
                    // Strictly Dine-in order type
                    if (order.orderType !== 'dine-in') return false;
                } else {
                    // Delivery Provider Filter
                    if (!isDelivery) return false;
                    const provider = getDeliveryProviderName(order);
                    // Match provider name (case-sensitive as charts use exact labels)
                    if (provider !== selectedOrderTypeFilter) return false;
                }
            }

            return true;
        });
    }, [completedOrders, selectedDate, currentUser, viewMode, selectedOrderTypeFilter]);

    // NEW: Active Orders for Charts (Apply Hour Filter if selected)
    const ordersForCharts = useMemo(() => {
        if (selectedHourFilter === null) return filteredCompletedOrders;

        return filteredCompletedOrders.filter(order => {
            // NOTE: Filter based on Order Start Time (Behavior)
            const orderStartHour = new Date(order.orderTime).getHours();
            return orderStartHour === selectedHourFilter;
        });
    }, [filteredCompletedOrders, selectedHourFilter]);

    const filteredCancelledOrders = useMemo(() => {
        let orders = cancelledOrders;

        // Soft delete logic: hide deleted items for non-admins
        if (currentUser?.role !== 'admin') {
            orders = orders.filter(o => !o.isDeleted);
        }

        return orders.filter(order => {
            const orderDate = new Date(order.cancellationTime);
            let matchesDate = false;
            
            if (viewMode === 'monthly') {
                matchesDate = orderDate.getMonth() === selectedDate.getMonth() &&
                              orderDate.getFullYear() === selectedDate.getFullYear();
            } else {
                matchesDate = orderDate.getDate() === selectedDate.getDate() &&
                              orderDate.getMonth() === selectedDate.getMonth() &&
                              orderDate.getFullYear() === selectedDate.getFullYear();
            }

            if (!matchesDate) return false;

            // Apply Order Type Filter with Provider Support
            if (selectedOrderTypeFilter) {
                const isDelivery = order.orderType === 'lineman';
                const isTakeawayOrder = order.orderType === 'takeaway';

                if (selectedOrderTypeFilter === 'กลับบ้าน') {
                    if (!isTakeawayOrder) return false;
                } else if (selectedOrderTypeFilter === 'ทานที่ร้าน') {
                    if (order.orderType !== 'dine-in') return false;
                } else {
                    if (!isDelivery) return false;
                    const provider = getDeliveryProviderName(order);
                    if (provider !== selectedOrderTypeFilter) return false;
                }
            }

            return true;
        });
    }, [cancelledOrders, selectedDate, currentUser, viewMode, selectedOrderTypeFilter]);

    const dailyStats = useMemo(() => {
        // Stats use global filtered orders (not hour filtered) to show daily summary unless we want dynamic stats too.
        // Usually dashboard stats remain for the day. Let's keep them day-based.
        const totalSales = filteredCompletedOrders.reduce((sum, order) => {
            const subtotal = order.items.reduce((itemSum, item) => {
                // Apply Category Filter to Sum if active
                if (selectedCategoryFilter && (item.category || 'ไม่มีหมวดหมู่') !== selectedCategoryFilter) {
                    return itemSum;
                }
                return itemSum + item.finalPrice * item.quantity;
            }, 0);
            
            return sum + subtotal + (selectedCategoryFilter ? 0 : order.taxAmount);
        }, 0);
        
        const totalCustomers = filteredCompletedOrders.reduce((sum, order) => sum + order.customerCount, 0);
        const averagePerCustomer = totalCustomers > 0 ? totalSales / totalCustomers : 0;
        
        return {
            totalSales,
            completedCount: filteredCompletedOrders.length,
            cancelledCount: filteredCancelledOrders.length,
            totalCustomers,
            averagePerCustomer
        };
    }, [filteredCompletedOrders, filteredCancelledOrders, selectedCategoryFilter]);

    // UPDATED: Chart Data Logic to support Category Filter AND Hourly Filter (via ordersForCharts)
    const chartData = useMemo(() => {
        if (viewMode === 'monthly') {
            // --- Monthly View ---
            const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const salesByDay = new Array(days.length).fill(0);

            ordersForCharts.forEach(order => {
                const day = new Date(order.completionTime).getDate();
                if (day >= 1 && day <= daysInMonth) {
                    let orderTotal = 0;
                    
                    if (selectedCategoryFilter) {
                        orderTotal = order.items.reduce((sum, item) => {
                            const itemCategory = item.category || 'ไม่มีหมวดหมู่';
                            if (itemCategory === selectedCategoryFilter) {
                                return sum + (item.finalPrice * item.quantity);
                            }
                            return sum;
                        }, 0);
                    } else {
                        orderTotal = order.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0) + order.taxAmount;
                    }

                    salesByDay[day - 1] += orderTotal;
                }
            });

            return {
                title: selectedCategoryFilter ? `ยอดขายรายวัน: ${selectedCategoryFilter}` : 'ยอดขายรายวัน (ตลอดเดือน)',
                labels: days.map(d => `${d}`),
                data: salesByDay,
                maxValue: Math.max(...salesByDay, 1000)
            };

        } else {
            // --- Daily View: Sales per Hour ---
            const openHour = parseInt(String(openingTime).split(':')[0], 10);
            const closeHour = parseInt(String(closingTime).split(':')[0], 10);
            const startH = isNaN(openHour) ? 0 : openHour;
            const endH = isNaN(closeHour) ? 23 : closeHour;
            
            const hoursLength = endH >= startH ? endH - startH + 1 : (24 - startH) + endH + 1;
            const hours = Array.from({ length: hoursLength }, (_, i) => (startH + i) % 24);
            
            const salesByHour = new Array(hours.length).fill(0);
            
            ordersForCharts.forEach(order => {
                const orderHour = new Date(order.completionTime).getHours();
                const hourIndex = hours.indexOf(orderHour);
                if (hourIndex > -1) {
                    let orderTotal = 0;

                    if (selectedCategoryFilter) {
                        orderTotal = order.items.reduce((sum, item) => {
                            const itemCategory = item.category || 'ไม่มีหมวดหมู่';
                            if (itemCategory === selectedCategoryFilter) {
                                return sum + (item.finalPrice * item.quantity);
                            }
                            return sum;
                        }, 0);
                    } else {
                        orderTotal = order.items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0) + order.taxAmount;
                    }

                    salesByHour[hourIndex] += orderTotal;
                }
            });

            return {
                title: selectedCategoryFilter ? `ยอดขายรายชั่วโมง: ${selectedCategoryFilter}` : 'ยอดขายรายชั่วโมง',
                labels: hours.map(h => `${h}:00`),
                data: salesByHour,
                maxValue: Math.max(...salesByHour, 1000)
            };
        }
    }, [ordersForCharts, openingTime, closingTime, viewMode, selectedDate, selectedCategoryFilter]);

    // UPDATED: Order Item Type Data - Breaks down delivery providers
    const orderItemTypeData = useMemo(() => {
        let dineInItems = 0;
        let takeawayItems = 0;
        const deliveryItemsMap: Record<string, number> = {};
        
        ordersForCharts.forEach(order => {
            const isDelivery = order.orderType === 'lineman';
            const providerName = isDelivery ? getDeliveryProviderName(order) : null;
            
            order.items.forEach(item => {
                if (selectedCategoryFilter) {
                    const itemCategory = item.category || 'ไม่มีหมวดหมู่';
                    if (itemCategory !== selectedCategoryFilter) return;
                }

                if (isDelivery && providerName) {
                    deliveryItemsMap[providerName] = (deliveryItemsMap[providerName] || 0) + item.quantity;
                } else if (item.isTakeaway) {
                    takeawayItems += item.quantity;
                } else {
                    dineInItems += item.quantity;
                }
            });
        });

        const labels = ['ทานที่ร้าน', 'กลับบ้าน'];
        const data = [dineInItems, takeawayItems];
        const colors = ['#3b82f6', '#8b5cf6']; // Blue, Purple

        // Sort delivery providers by volume
        const sortedProviders = Object.entries(deliveryItemsMap).sort((a, b) => b[1] - a[1]);

        sortedProviders.forEach(([name, count]) => {
            labels.push(name);
            data.push(count);
            
            // Assign distinct colors based on name
            const lowerName = name.toLowerCase();
            if (lowerName.includes('lineman')) colors.push('#10b981'); // Emerald Green
            else if (lowerName.includes('shopee')) colors.push('#f97316'); // Orange
            else if (lowerName.includes('grab')) colors.push('#22c55e'); // Green
            else if (lowerName.includes('robin')) colors.push('#a855f7'); // Purple
            else if (lowerName.includes('panda')) colors.push('#ec4899'); // Pink
            else colors.push('#64748b'); // Slate for unknown
        });

        return {
            title: selectedCategoryFilter ? `ประเภทรายการ: ${selectedCategoryFilter}` : 'ประเภทรายการ (แยกตามผู้ให้บริการ)',
            labels,
            data,
            colors
        };
    }, [ordersForCharts, selectedCategoryFilter]);

    // UPDATED: Category sales data - Uses ordersForCharts (Filtered by Hour)
    const categorySalesData = useMemo(() => {
        const salesByCategory: Record<string, number> = {};
        
        ordersForCharts.forEach(order => {
            order.items.forEach(item => {
                const category = item.category || 'ไม่มีหมวดหมู่';
                const itemTotal = item.finalPrice * item.quantity;
                salesByCategory[category] = (salesByCategory[category] || 0) + itemTotal;
            });
        });

        const sortedCategories = Object.entries(salesByCategory).sort(([, a], [, b]) => b - a);

        return {
            labels: sortedCategories.map(([label]) => label),
            data: sortedCategories.map(([, data]) => data),
            colors: ['#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#ef4444', '#6b7280']
        };
    }, [ordersForCharts]);

    // --- Hourly Traffic Analytics (Behavior Analysis) ---
    const hourlyInsights = useMemo(() => {
        // ALWAYS use filteredCompletedOrders (full day) for this chart, 
        // because it acts as the navigator/filter controller.
        const hourlyDistribution = new Array(24).fill(0);
        
        filteredCompletedOrders.forEach(order => {
            // Use orderTime (when they started ordering) to analyze behavior
            const hour = new Date(order.orderTime).getHours();
            if (hour >= 0 && hour < 24) {
                hourlyDistribution[hour]++;
            }
        });

        const maxOrders = Math.max(...hourlyDistribution, 1);
        const peakHourIndex = hourlyDistribution.indexOf(maxOrders);
        const peakHourStr = maxOrders > 0 
            ? `${String(peakHourIndex).padStart(2, '0')}:00 - ${String(peakHourIndex + 1).padStart(2, '0')}:00` 
            : 'ไม่มีข้อมูล';

        const openHour = parseInt(String(openingTime).split(':')[0], 10);
        const closeHour = parseInt(String(closingTime).split(':')[0], 10);
        const startH = isNaN(openHour) ? 0 : openHour;
        const endH = isNaN(closeHour) ? 23 : closeHour;
        
        const displayStart = Math.max(0, startH - 1);
        const displayEnd = Math.min(23, endH + 1);
        
        const displayLabels = [];
        const displayData = [];
        const displayHours = []; // To map index back to actual hour
        
        for(let i = displayStart; i <= displayEnd; i++) {
            displayLabels.push(`${String(i).padStart(2, '0')}:00`);
            displayData.push(hourlyDistribution[i]);
            displayHours.push(i);
        }

        // --- NEW: Calculate Actual Average ---
        // Count active hours (hours with > 0 orders)
        const activeHoursCount = hourlyDistribution.filter(count => count > 0).length;
        const totalOrders = filteredCompletedOrders.length;
        const averageOrders = activeHoursCount > 0 ? Math.round(totalOrders / activeHoursCount) : 0;

        return {
            data: displayData,
            labels: displayLabels,
            displayHours,
            peakHourStr,
            maxOrders,
            averageOrders, // Pass the correct average
            totalOrders: filteredCompletedOrders.length
        };
    }, [filteredCompletedOrders, openingTime, closingTime]);

    // --- NEW: Monthly & Menu Insights Calculation ---
    // This runs on completedOrders but filtered to the MONTH of the selectedDate
    // This allows seeing "Highest Day of Month" even if viewing Daily mode
    const monthlyInsights = useMemo(() => {
        // 1. Filter all orders for the SELECTED MONTH
        const ordersInMonth = completedOrders.filter(o => {
            if (currentUser?.role !== 'admin' && o.isDeleted) return false;
            const d = new Date(o.completionTime);
            return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
        });

        // 2. Financial Stats (Avg, Max, Min)
        const salesByDate = new Map<string, number>();
        const itemSales = new Map<string, number>();

        ordersInMonth.forEach(o => {
            // Aggregate Sales by Date
            const dateKey = new Date(o.completionTime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            const total = o.items.reduce((s, i) => s + (i.finalPrice * i.quantity), 0) + o.taxAmount;
            salesByDate.set(dateKey, (salesByDate.get(dateKey) || 0) + total);

            // Aggregate Menu Items
            o.items.forEach(i => {
                itemSales.set(i.name, (itemSales.get(i.name) || 0) + i.quantity);
            });
        });

        // Calculate Revenue Stats
        const salesValues = Array.from(salesByDate.entries());
        
        // Average
        const totalRevenue = salesValues.reduce((sum, [, val]) => sum + val, 0);
        const daysWithSales = salesValues.length;
        const averageDailyRevenue = daysWithSales > 0 ? totalRevenue / daysWithSales : 0;

        // Max & Min
        salesValues.sort((a, b) => b[1] - a[1]); // Descending
        const highestDay = salesValues.length > 0 ? salesValues[0] : null; // [DateStr, Amount]
        const lowestDay = salesValues.length > 0 ? salesValues[salesValues.length - 1] : null;

        // Menu Analysis
        const menuRanking = Array.from(itemSales.entries()).sort((a, b) => b[1] - a[1]);
        const top5 = menuRanking.slice(0, 5);
        const bottom5 = menuRanking.length > 5 ? menuRanking.slice(-5).reverse() : []; // Show lowest 5, reversed to show lowest first

        return {
            averageDailyRevenue,
            highestDay,
            lowestDay,
            top5,
            bottom5,
            hasData: ordersInMonth.length > 0
        };
    }, [completedOrders, selectedDate, currentUser]);


    const handleHourlyTrafficClick = (index: number) => {
        const clickedHour = hourlyInsights.displayHours[index];
        if (selectedHourFilter === clickedHour) {
            setSelectedHourFilter(null);
        } else {
            setSelectedHourFilter(clickedHour);
        }
    };

    const formattedDateDisplay = useMemo(() => {
        if (viewMode === 'monthly') {
            return selectedDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
        }
        return selectedDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    }, [selectedDate, viewMode]);

    // Calculate selected index for chart highlighting
    const selectedTrafficIndex = selectedHourFilter !== null 
        ? hourlyInsights.displayHours.indexOf(selectedHourFilter)
        : null;

    return (
        <div className="p-4 md:p-6 space-y-6 h-full overflow-y-auto w-full pb-24">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800">
                    Dashboard <span className="text-lg font-medium text-gray-500">({formattedDateDisplay})</span>
                </h1>
                
                <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    {canViewMonthly && (
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => handleViewModeChange('daily')}
                                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                                    viewMode === 'daily' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                รายวัน
                            </button>
                            <button
                                onClick={() => handleViewModeChange('monthly')}
                                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                                    viewMode === 'monthly' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                รายเดือน
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <label className="text-gray-600 font-medium text-sm hidden sm:inline">
                            {viewMode === 'monthly' ? 'เลือกเดือน:' : 'เลือกวันที่:'}
                        </label>
                        <div className="relative">
                            <input 
                                ref={dateInputRef}
                                type={viewMode === 'monthly' ? 'month' : 'date'}
                                value={dateInputValue}
                                onChange={handleDateChange}
                                onClick={() => { try { dateInputRef.current?.showPicker(); } catch(e) {} }}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-800 font-medium text-sm cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="ยอดขายรวม" value={`${dailyStats.totalSales.toLocaleString('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 })}`} icon={<span>💰</span>} color="border-green-500" />
                <StatCard title="ออเดอร์สำเร็จ" value={dailyStats.completedCount.toLocaleString()} icon={<span>✅</span>} color="border-blue-500" />
                <StatCard title="ลูกค้าทั้งหมด" value={dailyStats.totalCustomers.toLocaleString()} icon={<span>👥</span>} color="border-purple-500" />
                <StatCard title="ยกเลิกออเดอร์" value={dailyStats.cancelledCount.toLocaleString()} icon={<span>❌</span>} color="border-red-500" />
            </div>

            {/* Filter Indicator */}
            {(selectedCategoryFilter || selectedOrderTypeFilter || selectedHourFilter !== null) && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between animate-fade-in-up">
                    <div className="flex items-center gap-2 flex-wrap">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold">กำลังแสดงข้อมูล:</span>
                        {selectedHourFilter !== null && <span className="bg-orange-200 text-orange-900 px-2 py-0.5 rounded text-sm font-bold">เวลา {String(selectedHourFilter).padStart(2, '0')}:00 - {String(selectedHourFilter+1).padStart(2, '0')}:00</span>}
                        {selectedOrderTypeFilter && <span className="bg-blue-200 text-blue-900 px-2 py-0.5 rounded text-sm font-bold">{selectedOrderTypeFilter}</span>}
                        {selectedCategoryFilter && <span className="bg-blue-200 text-blue-900 px-2 py-0.5 rounded text-sm font-bold">{selectedCategoryFilter}</span>}
                    </div>
                    <button 
                        onClick={handleClearFilter}
                        className="text-sm font-semibold hover:underline text-blue-600 whitespace-nowrap ml-2"
                    >
                        ล้างตัวกรอง
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <SalesChart
                            title={chartData.title}
                            data={chartData.data}
                            labels={chartData.labels}
                            maxValue={chartData.maxValue}
                        />
                    </div>
                    
                    {/* Hourly Traffic Analytics Section */}
                    <div className={`bg-white p-6 rounded-xl shadow-md border-t-4 border-orange-400 transition-colors ${selectedHourFilter !== null ? 'ring-2 ring-orange-300' : ''}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    วิเคราะห์พฤติกรรมช่วงเวลาสั่งอาหาร (Customer Traffic)
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    คลิกที่กราฟเพื่อดูรายละเอียดยอดขายของช่วงเวลานั้นๆ
                                </p>
                            </div>
                            <div className="mt-4 sm:mt-0 bg-orange-50 px-4 py-3 rounded-lg border border-orange-200 text-right">
                                <p className="text-xs text-orange-800 font-semibold uppercase tracking-wider">ช่วงเวลาขายดีที่สุด (PEAK HOUR)</p>
                                <p className="text-2xl font-black text-orange-600">{hourlyInsights.peakHourStr}</p>
                                <div className="flex flex-col items-end gap-0.5 mt-1">
                                    {hourlyInsights.maxOrders > 0 && (
                                        <p className="text-sm text-orange-800 font-bold">
                                            {hourlyInsights.maxOrders} ออเดอร์ <span className="text-xs font-normal opacity-80">(สูงสุด)</span>
                                        </p>
                                    )}
                                    {hourlyInsights.averageOrders > 0 && (
                                        <p className="text-xs text-orange-700 font-medium">
                                            เฉลี่ยทั้งวัน {hourlyInsights.averageOrders} ออเดอร์/ชม.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="w-full overflow-x-auto">
                            <SalesChart
                                title=""
                                data={hourlyInsights.data}
                                labels={hourlyInsights.labels}
                                maxValue={hourlyInsights.maxOrders > 0 ? hourlyInsights.maxOrders : 10}
                                formatValue={(val) => val + ' ครั้ง'}
                                onBarClick={handleHourlyTrafficClick}
                                selectedIndex={selectedTrafficIndex !== -1 ? selectedTrafficIndex : null}
                            />
                        </div>
                    </div>

                    {/* --- MOVED: Monthly Insights Section --- */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <h3 className="text-xl font-bold text-indigo-900">สรุปภาพรวมและวิเคราะห์เมนูประจำเดือน {selectedDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</h3>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-8">
                            {/* Left: Financial Stats */}
                            <div className="xl:col-span-2 space-y-4">
                                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 font-medium">รายได้เฉลี่ย / วัน</p>
                                        <p className="text-3xl font-bold text-indigo-600 mt-1">
                                            {monthlyInsights.averageDailyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} ฿
                                        </p>
                                    </div>
                                    <div className="p-3 bg-indigo-50 rounded-full text-indigo-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-lg border border-green-200 shadow-sm flex items-center justify-between bg-green-50/30">
                                    <div>
                                        <p className="text-green-700 font-medium flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 7a1 1 0 110-2 1 1 0 010 2zm1 2a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /><path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" /></svg>
                                            วันยอดขายสูงสุด
                                        </p>
                                        <p className="text-2xl font-bold text-gray-800 mt-1">
                                            {monthlyInsights.highestDay ? monthlyInsights.highestDay[1].toLocaleString() : 0} ฿
                                        </p>
                                        <p className="text-sm text-green-600 mt-1 font-semibold">
                                            วันที่: {monthlyInsights.highestDay ? monthlyInsights.highestDay[0] : '-'}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-green-100 rounded-full text-green-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-lg border border-red-200 shadow-sm flex items-center justify-between bg-red-50/30">
                                    <div>
                                        <p className="text-red-700 font-medium flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 13a1 1 0 100 2 1 1 0 000-2zm1-8a1 1 0 100-2 1 1 0 000 2zM5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" /></svg>
                                            วันยอดขายต่ำสุด
                                        </p>
                                        <p className="text-2xl font-bold text-gray-800 mt-1">
                                            {monthlyInsights.lowestDay ? monthlyInsights.lowestDay[1].toLocaleString() : 0} ฿
                                        </p>
                                        <p className="text-sm text-red-600 mt-1 font-semibold">
                                            วันที่: {monthlyInsights.lowestDay ? monthlyInsights.lowestDay[0] : '-'}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-red-100 rounded-full text-red-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Menu Analysis */}
                            <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Top Selling */}
                                <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col h-full">
                                    <div className="p-4 border-b bg-green-50 flex items-center justify-between">
                                        <h4 className="font-bold text-green-800 flex items-center gap-2">
                                            <span className="text-lg">🏆</span> 5 เมนูขายดีที่สุด
                                        </h4>
                                    </div>
                                    <div className="p-2 flex-1">
                                        {monthlyInsights.top5.length > 0 ? (
                                            <ul className="space-y-1">
                                                {monthlyInsights.top5.map(([name, qty], idx) => (
                                                    <li key={idx} className="flex justify-between items-center p-2 hover:bg-green-50/50 rounded-lg transition-colors">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0 ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-green-200 text-green-800'}`}>
                                                                {idx + 1}
                                                            </span>
                                                            <span className="font-medium text-gray-700 truncate">{name}</span>
                                                        </div>
                                                        <span className="font-bold text-green-600 whitespace-nowrap">{qty} จาน</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
                                        )}
                                    </div>
                                </div>

                                {/* Least Selling */}
                                <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col h-full">
                                    <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                        <h4 className="font-bold text-gray-600 flex items-center gap-2">
                                            <span className="text-lg">📉</span> 5 เมนูขายน้อย/ควรปรับปรุง
                                        </h4>
                                    </div>
                                    <div className="p-2 flex-1">
                                        {monthlyInsights.bottom5.length > 0 ? (
                                            <ul className="space-y-1">
                                                {monthlyInsights.bottom5.map(([name, qty], idx) => (
                                                    <li key={idx} className="flex justify-between items-center p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold bg-gray-200 text-gray-500 flex-shrink-0">
                                                                {monthlyInsights.top5.length + idx + 1}
                                                            </span>
                                                            <span className="font-medium text-gray-600 truncate">{name}</span>
                                                        </div>
                                                        <span className="font-bold text-gray-500 whitespace-nowrap">{qty} จาน</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col gap-6">
                    <PieChart
                        title="สัดส่วนยอดขายตามหมวดหมู่"
                        data={categorySalesData.data}
                        labels={categorySalesData.labels}
                        colors={categorySalesData.colors}
                        onSliceClick={handleCategoryClick}
                        selectedLabel={selectedCategoryFilter}
                    />
                     <PieChart
                        title={orderItemTypeData.title}
                        data={orderItemTypeData.data}
                        labels={orderItemTypeData.labels}
                        colors={orderItemTypeData.colors}
                        onSliceClick={handleOrderTypeClick}
                        selectedLabel={selectedOrderTypeFilter}
                    />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
