
import React, { useMemo, useState } from 'react';
import type { StockItem } from '../types';
import PieChart from './PieChart';
import { SalesChart } from './SalesChart'; // Reusing SalesChart for bar display

interface StockAnalyticsProps {
    stockItems: StockItem[];
}

export const StockAnalytics: React.FC<StockAnalyticsProps> = ({ stockItems }) => {
    // State for Modal
    const [selectedGroup, setSelectedGroup] = useState<'total' | 'good' | 'low' | 'out' | null>(null);

    // --- 1. Calculate Status Counts & Lists ---
    const stats = useMemo(() => {
        let outOfStock = 0;
        let lowStock = 0;
        let goodStock = 0;
        const outOfStockItems: StockItem[] = [];
        const lowStockItems: StockItem[] = [];
        const goodStockItems: StockItem[] = [];

        stockItems.forEach(item => {
            const qty = Number(item.quantity) || 0;
            const reorder = Number(item.reorderPoint) || 0;

            if (qty <= 0) {
                outOfStock++;
                outOfStockItems.push(item);
            } else if (qty <= reorder) {
                lowStock++;
                lowStockItems.push(item);
            } else {
                goodStock++;
                goodStockItems.push(item);
            }
        });

        // Sort items by name for easier reading in lists
        const sortByName = (a: StockItem, b: StockItem) => a.name.localeCompare(b.name);
        outOfStockItems.sort(sortByName);
        lowStockItems.sort(sortByName);
        goodStockItems.sort(sortByName);
        
        // Total items sorted
        const allItems = [...stockItems].sort(sortByName);

        return {
            total: stockItems.length,
            outOfStock,
            lowStock,
            goodStock,
            outOfStockItems,
            lowStockItems,
            goodStockItems,
            allItems
        };
    }, [stockItems]);

    // --- 2. Prepare Chart Data ---
    
    // Pie Chart: Stock Health
    const stockHealthData = {
        labels: ['ปกติ', 'ใกล้หมด', 'หมดแล้ว'],
        data: [stats.goodStock, stats.lowStock, stats.outOfStock],
        colors: ['#10b981', '#f59e0b', '#ef4444'] // Green, Amber, Red
    };

    // Bar Chart: High Withdrawal Items (Based on Monthly History)
    const currentMonthKey = new Date().toISOString().slice(0, 7); // e.g. "2023-10"
    
    const topRotationItems = useMemo(() => {
        return [...stockItems]
            .sort((a, b) => {
                const countA = a.monthlyWithdrawals?.[currentMonthKey] || 0;
                const countB = b.monthlyWithdrawals?.[currentMonthKey] || 0;
                return countB - countA;
            })
            .slice(0, 7); // Top 7
    }, [stockItems, currentMonthKey]);

    const rotationData = {
        labels: topRotationItems.map(i => i.name),
        data: topRotationItems.map(i => i.monthlyWithdrawals?.[currentMonthKey] || 0),
        images: topRotationItems.map(i => i.imageUrl || ''), // Extract images
        maxValue: Math.max(...topRotationItems.map(i => i.monthlyWithdrawals?.[currentMonthKey] || 0), 10)
    };

    // --- Helper to get data for modal ---
    const getModalData = () => {
        switch (selectedGroup) {
            case 'total': return { title: 'รายการสินค้าทั้งหมด', items: stats.allItems, colorClass: 'bg-blue-600' };
            case 'good': return { title: 'สินค้าสถานะปกติ', items: stats.goodStockItems, colorClass: 'bg-green-600' };
            case 'low': return { title: 'สินค้าใกล้หมด (ต้องสั่งเพิ่ม)', items: stats.lowStockItems, colorClass: 'bg-yellow-500' };
            case 'out': return { title: 'สินค้าหมดสต็อก!', items: stats.outOfStockItems, colorClass: 'bg-red-600' };
            default: return null;
        }
    };

    const modalData = getModalData();

    return (
        <div className="flex flex-col h-full w-full bg-gray-50 overflow-y-auto p-6 relative">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                สถิติการเบิกและสถานะสต็อก (รายเดือน)
            </h1>

            {/* KPI Cards (Clickable) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div 
                    onClick={() => setSelectedGroup('total')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all transform hover:-translate-y-1"
                >
                    <div>
                        <p className="text-sm text-gray-500 font-medium">สินค้าทั้งหมด</p>
                        <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total} รายการ</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                </div>
                <div 
                    onClick={() => setSelectedGroup('good')}
                    className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500 flex items-center justify-between cursor-pointer hover:shadow-lg hover:bg-green-50/20 transition-all transform hover:-translate-y-1"
                >
                    <div>
                        <p className="text-sm text-gray-500 font-medium">สถานะปกติ</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{stats.goodStock} รายการ</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-full text-green-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                </div>
                <div 
                    onClick={() => setSelectedGroup('low')}
                    className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-400 flex items-center justify-between cursor-pointer hover:shadow-lg hover:bg-yellow-50/20 transition-all transform hover:-translate-y-1"
                >
                    <div>
                        <p className="text-sm text-gray-500 font-medium">ใกล้หมด (ต้องสั่งเพิ่ม)</p>
                        <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.lowStock} รายการ</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-full text-yellow-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                </div>
                <div 
                    onClick={() => setSelectedGroup('out')}
                    className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500 flex items-center justify-between cursor-pointer hover:shadow-lg hover:bg-red-50/20 transition-all transform hover:-translate-y-1"
                >
                    <div>
                        <p className="text-sm text-gray-500 font-medium">สินค้าหมด!</p>
                        <p className="text-2xl font-bold text-red-600 mt-1">{stats.outOfStock} รายการ</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-full text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                </div>
            </div>

            {/* Charts Section - Expanded to 4 columns to fill space */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-white p-6 rounded-xl shadow-sm lg:col-span-1">
                    <PieChart 
                        title="สัดส่วนสถานะสินค้าคงคลัง" 
                        data={stockHealthData.data} 
                        labels={stockHealthData.labels} 
                        colors={stockHealthData.colors} 
                    />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm lg:col-span-3">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-gray-800">สินค้าที่มีการเบิกออกสูงสุด (เดือนปัจจุบัน)</h3>
                        <p className="text-xs text-gray-500">*นับจากประวัติการเบิกสินค้าในเดือนนี้เท่านั้น</p>
                    </div>
                    <SalesChart
                        title=""
                        data={rotationData.data}
                        labels={rotationData.labels}
                        images={rotationData.images} // Pass images to chart
                        maxValue={rotationData.maxValue}
                        formatValue={(val) => val.toLocaleString() + ' ครั้ง'} // Show number with unit
                    />
                </div>
            </div>

            {/* Action List Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        รายการที่ต้องจัดการเร่งด่วน
                    </h3>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-gray-500 bg-gray-50 uppercase text-xs sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 bg-gray-50">สินค้า</th>
                                <th className="px-6 py-3 bg-gray-50">หมวดหมู่</th>
                                <th className="px-6 py-3 bg-gray-50 text-right">คงเหลือ</th>
                                <th className="px-6 py-3 bg-gray-50 text-right">จุดสั่งซื้อ</th>
                                <th className="px-6 py-3 bg-gray-50 text-center">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...stats.outOfStockItems, ...stats.lowStockItems].length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span className="font-medium text-green-600">สต็อกอยู่ในเกณฑ์ดีเยี่ยม ไม่มีรายการต้องสั่งเพิ่ม</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                [...stats.outOfStockItems, ...stats.lowStockItems].map((item) => (
                                    <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                                                <img src={item.imageUrl || "https://placehold.co/100?text=No+Image"} alt={item.name} className="w-full h-full object-cover" onError={(e) => e.currentTarget.src = "https://placehold.co/100?text=Error"} />
                                            </div>
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">{item.category}</td>
                                        <td className={`px-6 py-4 text-right font-bold ${Number(item.quantity) <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                                            {Number(item.quantity).toLocaleString()} {item.unit}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            {Number(item.reorderPoint).toLocaleString()} {item.unit}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {Number(item.quantity) <= 0 ? (
                                                <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700">สินค้าหมด</span>
                                            ) : (
                                                <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-700">ใกล้หมด</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* List Detail Modal */}
            {modalData && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedGroup(null)}>
                    <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className={`${modalData.colorClass} px-6 py-4 flex justify-between items-center text-white`}>
                            <div>
                                <h3 className="text-xl font-bold">{modalData.title}</h3>
                                <p className="text-sm opacity-90">จำนวน: {modalData.items.length} รายการ</p>
                            </div>
                            <button onClick={() => setSelectedGroup(null)} className="p-1 rounded-full hover:bg-white/20 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto flex-1 p-0">
                            {modalData.items.length === 0 ? (
                                <div className="p-10 text-center text-gray-500 flex flex-col items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                    ไม่มีรายการในกลุ่มนี้
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-600 font-semibold border-b sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-6 py-3">สินค้า</th>
                                            <th className="px-6 py-3">หมวดหมู่</th>
                                            <th className="px-6 py-3 text-right">คงเหลือ / จุดสั่งซื้อ</th>
                                            <th className="px-6 py-3 text-center">หน่วย</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {modalData.items.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-3 flex items-center gap-3">
                                                    <span className="text-gray-400 text-xs w-4">{idx + 1}.</span>
                                                    <div className="w-10 h-10 rounded bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                                                        <img src={item.imageUrl || "https://placehold.co/100?text=No+Image"} alt={item.name} className="w-full h-full object-cover" onError={(e) => e.currentTarget.src = "https://placehold.co/100?text=Error"} />
                                                    </div>
                                                    <span className="font-medium text-gray-800">{item.name}</span>
                                                </td>
                                                <td className="px-6 py-3 text-gray-500">{item.category}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <span className={`font-bold text-lg ${Number(item.quantity) <= 0 ? 'text-red-600' : Number(item.quantity) <= Number(item.reorderPoint) ? 'text-yellow-600' : 'text-green-600'}`}>
                                                        {Number(item.quantity).toLocaleString()}
                                                    </span>
                                                    <span className="text-gray-400 mx-1">/</span>
                                                    <span className="text-gray-500 font-medium">
                                                        {Number(item.reorderPoint).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-center text-gray-500">{item.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        <div className="p-4 border-t bg-gray-50 text-right">
                            <button onClick={() => setSelectedGroup(null)} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors">
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
