
import React, { useState, useEffect } from 'react';
import type { StockItem } from '../types';
import Swal from 'sweetalert2';
import { UnitManagerModal } from './UnitManagerModal';
import { StockCategoryManagerModal } from './StockCategoryManagerModal';
import { NumpadModal } from './NumpadModal';

interface StockItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Omit<StockItem, 'id' | 'lastUpdated'> & { id?: number }) => void;
    itemToEdit: StockItem | null;
    categories: string[];
    setCategories: React.Dispatch<React.SetStateAction<string[]>>;
    units: string[];
    setUnits: React.Dispatch<React.SetStateAction<string[]>>;
    stockItems: StockItem[];
}

const initialFormState: Omit<StockItem, 'id' | 'lastUpdated'> = {
    name: '',
    category: '',
    imageUrl: '',
    quantity: 0,
    unit: '',
    reorderPoint: 0,
    orderDate: undefined,
    receivedDate: undefined
};

export const StockItemModal: React.FC<StockItemModalProps> = ({
    isOpen,
    onClose,
    onSave,
    itemToEdit,
    categories,
    setCategories,
    units,
    setUnits,
    stockItems
}) => {
    const [formState, setFormState] = useState(initialFormState);
    const [isUnitManagerOpen, setIsUnitManagerOpen] = useState(false);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const [numpadConfig, setNumpadConfig] = useState<{ isOpen: boolean; field: 'quantity' | 'reorderPoint' | null; title: string }>({ isOpen: false, field: null, title: '' });

    // Effect to reset/init form ONLY when modal opens
    useEffect(() => {
        if (isOpen) {
            if (itemToEdit) {
                setFormState({
                    ...itemToEdit,
                    // Ensure numbers are numbers, fallback to 0 if null/undefined/NaN
                    quantity: Number(itemToEdit.quantity) || 0,
                    reorderPoint: Number(itemToEdit.reorderPoint) || 0,
                    imageUrl: itemToEdit.imageUrl || '' 
                });
            } else {
                setFormState({ 
                    ...initialFormState, 
                    category: categories.length > 0 ? categories[0] : '', 
                    unit: units.length > 0 ? units[0] : '' 
                });
            }
        }
    }, [isOpen, itemToEdit]); 

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name || !formState.category || !formState.unit) {
            Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
            return;
        }

        // CRITICAL FIX: Ensure quantity and reorderPoint are strictly numbers before saving.
        // This prevents the "white screen" crash caused by .toLocaleString() on strings.
        const safeItem = {
            ...formState,
            quantity: Number(formState.quantity) || 0,
            reorderPoint: Number(formState.reorderPoint) || 0
        };

        onSave(safeItem);
    };

    const toInputDate = (ts?: number) => ts ? new Date(ts).toISOString().split('T')[0] : '';
    const fromInputDate = (val: string) => val ? new Date(val).getTime() : undefined;

    if (!isOpen) return null;

    // Helper to safely format numbers (prevent crash if undefined)
    const safeNumber = (num: number | undefined | null) => {
        const val = Number(num);
        return isNaN(val) ? 0 : val;
    };

    // Ensure text color is explicitly set to black
    const inputClasses = "mt-1 block w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
    const manageButtonClasses = "p-2 h-[42px] mt-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center justify-center";

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">{itemToEdit ? 'แก้ไขรายการในสต็อก' : 'เพิ่มรายการสต็อกใหม่'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ชื่อวัตถุดิบ</label>
                            <input type="text" name="name" value={formState.name || ''} onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))} className={inputClasses} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">รูปภาพ (URL)</label>
                            <div className="flex gap-4 items-start mt-1">
                                {formState.imageUrl && (
                                    <img src={formState.imageUrl} alt="Preview" className="w-16 h-16 object-cover rounded-md border border-gray-300 bg-gray-50" onError={(e) => e.currentTarget.style.display = 'none'} />
                                )}
                                <input type="text" name="imageUrl" value={formState.imageUrl || ''} onChange={(e) => setFormState(prev => ({ ...prev, imageUrl: e.target.value }))} className={inputClasses} placeholder="https://..." />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">จำนวนเริ่มต้น</label>
                            <div
                                onClick={() => setNumpadConfig({ isOpen: true, field: 'quantity', title: 'จำนวนเริ่มต้น' })}
                                className={`${inputClasses} cursor-pointer h-[42px] flex items-center`}
                            >
                                {safeNumber(formState.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="flex gap-2 items-end">
                            <div className="flex-grow">
                                <label className="block text-sm font-medium text-gray-700">หมวดหมู่</label>
                                <select name="category" value={formState.category || ''} onChange={(e) => setFormState(prev => ({ ...prev, category: e.target.value }))} className={inputClasses} required>
                                    <option value="" disabled>เลือกหมวดหมู่</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <button type="button" onClick={() => setIsCategoryManagerOpen(true)} className={manageButtonClasses}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.972.094 2.22-.948 2.286-1.56.38-1.56 2.6 0 2.98.972.54 2.22.094 2.286.948.836 1.372-.734 2.942-2.106 2.106a1.532 1.532 0 01-.948-2.286c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286-.948c-1.372.836-2.942-.734-2.106-2.106a1.532 1.532 0 01.948-2.286c.38-1.56 2.6-1.56 2.98 0a1.532 1.532 0 012.286-.948c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.948 2.286zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                        <div className="flex gap-2 items-end">
                             <div className="flex-grow">
                                <label className="block text-sm font-medium text-gray-700">หน่วยนับ</label>
                                <select name="unit" value={formState.unit || ''} onChange={(e) => setFormState(prev => ({ ...prev, unit: e.target.value }))} className={inputClasses} required>
                                    <option value="" disabled>เลือกหน่วยนับ</option>
                                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <button type="button" onClick={() => setIsUnitManagerOpen(true)} className={manageButtonClasses}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.972.094 2.22-.948 2.286-1.56.38-1.56 2.6 0 2.98.972.54 2.22.094 2.286.948.836 1.372-.734 2.942-2.106 2.106a1.532 1.532 0 01-.948-2.286c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286-.948c-1.372.836-2.942-.734-2.106-2.106a1.532 1.532 0 01.948-2.286c.38-1.56 2.6-1.56 2.98 0a1.532 1.532 0 012.286-.948c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.948 2.286zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">จุดสั่งซื้อขั้นต่ำ</label>
                             <div
                                onClick={() => setNumpadConfig({ isOpen: true, field: 'reorderPoint', title: 'จุดสั่งซื้อขั้นต่ำ' })}
                                className={`${inputClasses} cursor-pointer h-[42px] flex items-center text-black`}
                            >
                                {safeNumber(formState.reorderPoint).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                            <p className="mt-1 text-sm font-bold text-gray-700">ระบบจะแจ้งเตือนเมื่อจำนวนคงเหลือต่ำกว่าจุดนี้</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">วันที่สั่งของ</label>
                                <input type="date" value={toInputDate(formState.orderDate)} onChange={e => setFormState(prev => ({...prev, orderDate: fromInputDate(e.target.value)}))} className={inputClasses} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">วันที่รับของ</label>
                                <input type="date" value={toInputDate(formState.receivedDate)} onChange={e => setFormState(prev => ({...prev, receivedDate: fromInputDate(e.target.value)}))} className={inputClasses} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">ยกเลิก</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">บันทึก</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <UnitManagerModal
                isOpen={isUnitManagerOpen}
                onClose={() => setIsUnitManagerOpen(false)}
                units={units}
                setUnits={setUnits}
                stockItems={stockItems}
            />

            <StockCategoryManagerModal
                isOpen={isCategoryManagerOpen}
                onClose={() => setIsCategoryManagerOpen(false)}
                categories={categories}
                setCategories={setCategories}
                stockItems={stockItems}
            />

            <NumpadModal
                isOpen={numpadConfig.isOpen}
                onClose={() => setNumpadConfig({ ...numpadConfig, isOpen: false })}
                title={numpadConfig.title}
                initialValue={numpadConfig.field ? (formState[numpadConfig.field] || 0) : 0}
                onSubmit={(newValue) => {
                    if (numpadConfig.field) {
                        setFormState(prev => ({
                            ...prev,
                            [numpadConfig.field!]: newValue
                        }));
                    }
                }}
            />
        </>
    );
};
