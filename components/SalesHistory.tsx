
import React, { useState, useMemo, useEffect } from 'react';
import type { CompletedOrder, CancelledOrder, PrintHistoryEntry, User } from '../types';
import { CompletedOrderCard } from './CompletedOrderCard';
import { CancelledOrderCard } from './CancelledOrderCard';
import { PrintHistoryCard } from './PrintHistoryCard';
import Swal from 'sweetalert2';

declare var XLSX: any;

interface SalesHistoryProps {
    completedOrders: CompletedOrder[];
    cancelledOrders: CancelledOrder[];
    printHistory: PrintHistoryEntry[];
    onReprint: (orderNumber: number) => void;
    onSplitOrder: (order: CompletedOrder) => void;
    isEditMode: boolean;
    onEditOrder: (order: CompletedOrder) => void;
    onInitiateCashBill: (order: CompletedOrder) => void;
    onDeleteHistory: (completedIds: number[], cancelledIds: number[], printIds: number[]) => Promise<void>;
    currentUser: User | null;
    onReprintReceipt: (order: CompletedOrder) => void; // New Prop for actual receipt reprint
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({
    completedOrders,
    cancelledOrders,
    printHistory,
    onReprint,
    onSplitOrder,
    isEditMode,
    onEditOrder,
    onInitiateCashBill,
    onDeleteHistory,
    currentUser,
    onReprintReceipt // Destructure
}) => {
    const [activeTab, setActiveTab] = useState<'completed' | 'cancelled' | 'print'>('completed');
    const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'year' | 'all'>('daily');
    const [selectedDate, setSelectedDate] = useState(new Date());
    // Local state for smooth typing of year input
    const [yearInput, setYearInput] = useState(new Date().getFullYear().toString());
    const [searchTerm, setSearchTerm] = useState('');
    
    // Selection state for deletion
    const [selectedCompletedIds, setSelectedCompletedIds] = useState<Set<number>>(new Set());
    const [selectedCancelledIds, setSelectedCancelledIds] = useState<Set<number>>(new Set());
    const [selectedPrintIds, setSelectedPrintIds] = useState<Set<number>>(new Set());

    // Sync year input when selectedDate or filterType changes
    useEffect(() => {
        setYearInput(selectedDate.getFullYear().toString());
    }, [selectedDate, filterType]);

    // ... helper functions for date handling ...
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        if (filterType === 'year') {
             // Allow only numeric input
             if (!/^\d*$/.test(val)) return;
             
             // Update the UI immediately for smooth typing
             setYearInput(val);

             // Only update the actual date state if it's a valid 4-digit year
             if (val.length === 4) {
                const year = parseInt(val);
                if (!isNaN(year) && year > 1900 && year < 2100) {
                    const newDate = new Date(selectedDate);
                    newDate.setFullYear(year);
                    setSelectedDate(newDate);
                }
             }
        } else if (val) {
            if (filterType === 'monthly') {
                const [year, month] = val.split('-').map(Number);
                setSelectedDate(new Date(year, month - 1, 1));
            } else {
                setSelectedDate(new Date(val));
            }
        }
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };

    const isSameMonth = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth();
    };

    const isSameYear = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear();
    };

    // Determine mobile filter value (Today vs Daily)
    const mobileFilterValue = useMemo(() => {
        if (filterType === 'daily' && isSameDay(selectedDate, new Date())) return 'today';
        return filterType;
    }, [filterType, selectedDate]);

    // ... Filtering logic ...
    const filteredCompleted = useMemo(() => {
        let items = completedOrders;
        // Logic Update: Only 'admin' and 'auditor' can see deleted items.
        // 'branch-admin' (Manager) will perform soft-delete but won't see them anymore.
        if (!['admin', 'auditor'].includes(currentUser?.role || '')) {
             items = items.filter(o => !o.isDeleted);
        }

        return items.filter(order => {
            const date = new Date(order.completionTime);
            let dateMatch = true;
            if (filterType === 'daily') dateMatch = isSameDay(date, selectedDate);
            else if (filterType === 'monthly') dateMatch = isSameMonth(date, selectedDate);
            else if (filterType === 'year') dateMatch = isSameYear(date, selectedDate);

            const searchMatch = !searchTerm || 
                order.orderNumber.toString().includes(searchTerm) || 
                (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (order.tableName && order.tableName.toLowerCase().includes(searchTerm.toLowerCase()));

            return dateMatch && searchMatch;
        });
    }, [completedOrders, filterType, selectedDate, searchTerm, currentUser]);

    const filteredCancelled = useMemo(() => {
        let items = cancelledOrders;
        // Logic Update: Only 'admin' and 'auditor' can see deleted items.
        if (!['admin', 'auditor'].includes(currentUser?.role || '')) {
             items = items.filter(o => !o.isDeleted);
        }

        return items.filter(order => {
            const date = new Date(order.cancellationTime);
            let dateMatch = true;
            if (filterType === 'daily') dateMatch = isSameDay(date, selectedDate);
            else if (filterType === 'monthly') dateMatch = isSameMonth(date, selectedDate);
            else if (filterType === 'year') dateMatch = isSameYear(date, selectedDate);

            const searchMatch = !searchTerm || 
                order.orderNumber.toString().includes(searchTerm) || 
                (order.tableName && order.tableName.toLowerCase().includes(searchTerm.toLowerCase()));

            return dateMatch && searchMatch;
        });
    }, [cancelledOrders, filterType, selectedDate, searchTerm, currentUser]);

    const filteredPrint = useMemo(() => {
        let items = printHistory;
        // Logic Update: Only 'admin' and 'auditor' can see deleted items.
        if (!['admin', 'auditor'].includes(currentUser?.role || '')) {
             items = items.filter(o => !o.isDeleted);
        }

        return items.filter(entry => {
            const date = new Date(entry.timestamp);
            let dateMatch = true;
            if (filterType === 'daily') dateMatch = isSameDay(date, selectedDate);
            else if (filterType === 'monthly') dateMatch = isSameMonth(date, selectedDate);
            else if (filterType === 'year') dateMatch = isSameYear(date, selectedDate);

            const searchMatch = !searchTerm || 
                entry.orderNumber.toString().includes(searchTerm) ||
                (entry.tableName && entry.tableName.toLowerCase().includes(searchTerm.toLowerCase()));

            return dateMatch && searchMatch;
        });
    }, [printHistory, filterType, selectedDate, searchTerm, currentUser]);

    // ... Export functions ...
    const handleExportHistory = () => {
        // Expand orders to item level rows
        const data: any[] = [];
        
        filteredCompleted.forEach(order => {
            const orderTotal = order.items.reduce((s, i) => s + i.finalPrice * i.quantity, 0) + order.taxAmount;
            
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    data.push({
                        'Order #': order.orderNumber,
                        'Date': new Date(order.completionTime).toLocaleDateString('th-TH'),
                        'Time': new Date(order.completionTime).toLocaleTimeString('th-TH'),
                        'Table': order.tableName,
                        'Customer': order.customerName || '-',
                        'Menu Item': item.name + (item.isTakeaway ? ' (กลับบ้าน)' : ''),
                        'Quantity': item.quantity,
                        'Unit Price': item.finalPrice,
                        'Item Total': item.finalPrice * item.quantity,
                        'Order Subtotal': orderTotal,
                        'Payment': order.paymentDetails.method,
                        'Cashier': order.completedBy || '-'
                    });
                });
            } else {
                // Fallback for empty orders
                data.push({
                    'Order #': order.orderNumber,
                    'Date': new Date(order.completionTime).toLocaleDateString('th-TH'),
                    'Time': new Date(order.completionTime).toLocaleTimeString('th-TH'),
                    'Table': order.tableName,
                    'Customer': order.customerName || '-',
                    'Menu Item': '(No Items)',
                    'Quantity': 0,
                    'Unit Price': 0,
                    'Item Total': 0,
                    'Order Subtotal': orderTotal,
                    'Payment': order.paymentDetails.method,
                    'Cashier': order.completedBy || '-'
                });
            }
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sales");
        XLSX.writeFile(wb, `Sales_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handleExportCancellations = () => {
        const data = filteredCancelled.map(order => ({
            'Order #': order.orderNumber,
            'Date': new Date(order.cancellationTime).toLocaleDateString('th-TH'),
            'Time': new Date(order.cancellationTime).toLocaleTimeString('th-TH'),
            'Table': order.tableName,
            'Reason': order.cancellationReason,
            'Notes': order.cancellationNotes,
            'Cancelled By': order.cancelledBy
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cancellations");
        XLSX.writeFile(wb, `Cancel_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    // ... Delete handlers ...
    const toggleSelect = (id: number, type: 'completed' | 'cancelled' | 'print') => {
        if (type === 'completed') {
            setSelectedCompletedIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                return newSet;
            });
        } else if (type === 'cancelled') {
            setSelectedCancelledIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                return newSet;
            });
        } else {
            setSelectedPrintIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                return newSet;
            });
        }
    };

    const handleDeleteSelected = async () => {
        const count = selectedCompletedIds.size + selectedCancelledIds.size + selectedPrintIds.size;
        if (count === 0) return;

        const result = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: `คุณต้องการลบรายการที่เลือกจำนวน ${count} รายการใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ลบเลย',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#d33'
        });

        if (result.isConfirmed) {
            await onDeleteHistory(
                Array.from(selectedCompletedIds), 
                Array.from(selectedCancelledIds), 
                Array.from(selectedPrintIds)
            );
            setSelectedCompletedIds(new Set());
            setSelectedCancelledIds(new Set());
            setSelectedPrintIds(new Set());
            Swal.fire('ลบแล้ว', 'รายการถูกลบเรียบร้อยแล้ว', 'success');
        }
    };

    // Date input formatting
    const dateInputValue = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        if (filterType === 'monthly') return `${year}-${month}`;
        if (filterType === 'year') return `${year}`;
        return `${year}-${month}-${day}`;
    }, [selectedDate, filterType]);

    // -- Helper Components for Styling --
    const TabPill = ({ id, label, count, active, onClick }: { id: string, label: string, count: number, active: boolean, onClick: () => void }) => (
        <button 
            onClick={onClick}
            className={`px-5 py-2.5 rounded-full text-base font-semibold transition-all shadow-sm flex items-center gap-2 ${
                active 
                ? 'bg-white text-gray-800 ring-2 ring-gray-200' 
                : 'bg-gray-200/50 text-gray-500 hover:bg-gray-200'
            }`}
        >
            {label} 
            <span className={`px-2 py-0.5 rounded-full text-xs ${active ? 'bg-gray-100 text-gray-700' : 'bg-gray-300 text-gray-600'}`}>
                {count}
            </span>
        </button>
    );

    const FilterPill = ({ label, value, active, onClick }: { label: string, value: string, active: boolean, onClick: () => void }) => (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
            {label}
        </button>
    );

    // Use a render function instead of a Component to prevent remounting/focus loss on input change
    const renderDateInput = () => (
        <div className="relative w-full md:w-auto">
            {filterType === 'year' ? (
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={yearInput} // Use local state
                    onChange={handleDateChange}
                    placeholder="YYYY"
                    className="w-full md:w-36 border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
            ) : (
                <input 
                    type={filterType === 'monthly' ? 'month' : 'date'}
                    value={dateInputValue}
                    onChange={handleDateChange}
                    className="w-full md:w-36 border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-50 p-4 md:p-8 overflow-hidden">
            
            {/* Header Section */}
            <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
                
                {/* 1. Tabs */}
                {/* Mobile Dropdown */}
                <div className="md:hidden relative w-full">
                    <select
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value as any)}
                        className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-blue-500 font-bold shadow-sm"
                    >
                        <option value="completed">ประวัติการขาย ({filteredCompleted.length})</option>
                        <option value="cancelled">ประวัติการยกเลิก ({filteredCancelled.length})</option>
                        <option value="print">ประวัติการพิมพ์ ({filteredPrint.length})</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>

                {/* Desktop Tabs */}
                <div className="hidden md:flex flex-wrap gap-3">
                    <TabPill id="completed" label="ประวัติการขาย" count={filteredCompleted.length} active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} />
                    <TabPill id="cancelled" label="ประวัติการยกเลิก" count={filteredCancelled.length} active={activeTab === 'cancelled'} onClick={() => setActiveTab('cancelled')} />
                    <TabPill id="print" label="ประวัติการพิมพ์" count={filteredPrint.length} active={activeTab === 'print'} onClick={() => setActiveTab('print')} />
                </div>

                {/* 2. Filters & Actions Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="w-full md:w-auto">
                        {/* Mobile Filter Row */}
                        <div className="md:hidden grid grid-cols-2 gap-2 w-full">
                            <div className="relative">
                                <select
                                    value={mobileFilterValue}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'today') {
                                            setFilterType('daily');
                                            setSelectedDate(new Date());
                                        } else {
                                            setFilterType(val as any);
                                        }
                                    }}
                                    className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 px-3 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-blue-500 font-medium shadow-sm text-sm"
                                >
                                    <option value="today">วันนี้</option>
                                    <option value="daily">รายวัน</option>
                                    <option value="monthly">รายเดือน</option>
                                    <option value="year">รายปี</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                            
                            {renderDateInput()}
                        </div>

                        {/* Desktop Filter Row */}
                        <div className="hidden md:flex items-center gap-4">
                            <div className="flex bg-gray-200/50 p-1 rounded-full">
                                <FilterPill label="วันนี้" value="daily" active={filterType === 'daily' && isSameDay(selectedDate, new Date())} onClick={() => {setFilterType('daily'); setSelectedDate(new Date());}} />
                                <FilterPill label="รายวัน" value="daily" active={filterType === 'daily' && !isSameDay(selectedDate, new Date())} onClick={() => setFilterType('daily')} />
                                <FilterPill label="รายเดือน" value="monthly" active={filterType === 'monthly'} onClick={() => setFilterType('monthly')} />
                                <FilterPill label="รายปี" value="year" active={filterType === 'year'} onClick={() => setFilterType('year')} />
                            </div>
                            {renderDateInput()}
                        </div>
                    </div>

                    {/* Export Button - Hidden on Mobile (< md) */}
                    {(activeTab === 'completed' || activeTab === 'cancelled') && (
                        <button 
                            onClick={activeTab === 'completed' ? handleExportHistory : handleExportCancellations} 
                            className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-md transition-all transform hover:-translate-y-0.5 active:scale-95"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            {activeTab === 'completed' ? 'Export Sales' : 'Export Log'}
                        </button>
                    )}
                </div>

                {/* 3. Search Bar */}
                <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input 
                        type="text" 
                        placeholder="ค้นหาด้วย #ID, ชื่อโต๊ะ, หรืออื่นๆ..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-white shadow-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                </div>
            </div>

            {/* Selection Toolbar (Edit Mode) */}
            {isEditMode && (
                <div className="bg-red-50 p-3 mb-4 rounded-xl border border-red-100 flex justify-between items-center animate-fade-in-up">
                    <span className="text-sm text-red-700 font-bold ml-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                        เลือก: {selectedCompletedIds.size + selectedCancelledIds.size + selectedPrintIds.size} รายการ
                    </span>
                    <button 
                        onClick={handleDeleteSelected}
                        disabled={selectedCompletedIds.size + selectedCancelledIds.size + selectedPrintIds.size === 0}
                        className="px-4 py-1.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        ลบที่เลือก
                    </button>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar">
                {activeTab === 'completed' && (
                    filteredCompleted.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredCompleted.map(order => (
                                <CompletedOrderCard 
                                    key={order.id} 
                                    order={order} 
                                    onSplitOrder={onSplitOrder}
                                    isEditMode={isEditMode}
                                    onEditOrder={onEditOrder}
                                    onInitiateCashBill={onInitiateCashBill}
                                    isSelected={selectedCompletedIds.has(order.id)}
                                    onToggleSelection={(id) => toggleSelect(id, 'completed')}
                                    onReprintReceipt={onReprintReceipt} // Pass new prop
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <p className="text-xl font-medium">ไม่พบประวัติการขายที่ตรงกับเงื่อนไข</p>
                        </div>
                    )
                )}

                {activeTab === 'cancelled' && (
                    filteredCancelled.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredCancelled.map(order => (
                                <CancelledOrderCard 
                                    key={order.id} 
                                    order={order} 
                                    isEditMode={isEditMode}
                                    isSelected={selectedCancelledIds.has(order.id)}
                                    onToggleSelection={(id) => toggleSelect(id, 'cancelled')}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <p className="text-xl font-medium">ไม่พบประวัติการยกเลิก</p>
                        </div>
                    )
                )}

                {activeTab === 'print' && (
                    filteredPrint.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredPrint.map(entry => (
                                <PrintHistoryCard
                                    key={entry.id}
                                    entry={entry}
                                    isEditMode={isEditMode}
                                    isSelected={selectedPrintIds.has(entry.id)}
                                    onToggleSelection={(id) => toggleSelect(id, 'print')}
                                    onReprint={onReprint}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <p className="text-xl font-medium">ไม่พบประวัติการพิมพ์</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
