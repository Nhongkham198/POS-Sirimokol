
import React, { useState, useEffect, useMemo } from 'react';
import type { MenuItem, MenuOption, OrderItem, MenuOptionGroup, TakeawayCutleryOption } from '../types';
import Swal from 'sweetalert2';
import { MenuItemImage } from './MenuItemImage';

interface ItemCustomizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: MenuItem | null;
    orderItemToEdit?: OrderItem | null; // Optional prop for editing
    onConfirm: (itemToAdd: OrderItem) => void;
}

export const ItemCustomizationModal: React.FC<ItemCustomizationModalProps> = ({ isOpen, onClose, item, onConfirm, orderItemToEdit }) => {
    const [selections, setSelections] = useState<Record<string, MenuOption[]>>({});
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [isTakeaway, setIsTakeaway] = useState(false);
    const [takeawayCutlery, setTakeawayCutlery] = useState<TakeawayCutleryOption[]>([]);
    const [takeawayCutleryNotes, setTakeawayCutleryNotes] = useState('');

    useEffect(() => {
        if (item) {
            if (orderItemToEdit) {
                // Populate state from existing item being edited
                const initialSelections: Record<string, MenuOption[]> = {};
                for (const group of orderItemToEdit.optionGroups || []) {
                    const selected = orderItemToEdit.selectedOptions.filter(opt => group.options.some(o => o.id === opt.id));
                    if (selected.length > 0) {
                        initialSelections[group.id] = selected;
                    }
                }
                setSelections(initialSelections);
                setQuantity(orderItemToEdit.quantity);
                setNotes(orderItemToEdit.notes || '');
                setIsTakeaway(orderItemToEdit.isTakeaway);
                setTakeawayCutlery(orderItemToEdit.takeawayCutlery || []);
                setTakeawayCutleryNotes(orderItemToEdit.takeawayCutleryNotes || '');

            } else {
                // Reset for a new item
                setSelections({});
                setQuantity(1);
                setNotes('');
                setIsTakeaway(false);
                setTakeawayCutlery([]);
                setTakeawayCutleryNotes('');
            }
        }
    }, [item, orderItemToEdit]);

    const { finalPrice, selectedOptions } = useMemo(() => {
        if (!item) return { finalPrice: 0, selectedOptions: [] };
        
        const basePrice = item.price;
        let optionsPrice = 0;
        const allSelectedOptions: MenuOption[] = [];

        Object.keys(selections).forEach(key => {
            const optionsArray = selections[key];
            optionsArray.forEach(option => {
                optionsPrice += option.priceModifier;
                allSelectedOptions.push(option);
            });
        });

        return {
            finalPrice: basePrice + optionsPrice,
            selectedOptions: allSelectedOptions
        };

    }, [item, selections]);

    const handleSingleSelect = (group: MenuOptionGroup, option: MenuOption) => {
        setSelections(prev => ({
            ...prev,
            [group.id]: [option]
        }));
    };

    const handleMultiSelect = (group: MenuOptionGroup, option: MenuOption) => {
        setSelections(prev => {
            const currentGroupSelection = prev[group.id] || [];
            const isSelected = currentGroupSelection.some(o => o.id === option.id);
            let newGroupSelection;
            if (isSelected) {
                newGroupSelection = currentGroupSelection.filter(o => o.id !== option.id);
            } else {
                newGroupSelection = [...currentGroupSelection, option];
            }
            return {
                ...prev,
                [group.id]: newGroupSelection
            };
        });
    };
    
    const handleCutleryChange = (option: TakeawayCutleryOption) => {
        setTakeawayCutlery(prev => {
            if (option === 'none') {
                return prev.includes('none') ? [] : ['none'];
            }
            let newSelection = prev.filter(o => o !== 'none');
            if (newSelection.includes(option)) {
                newSelection = newSelection.filter(o => o !== option);
            } else {
                newSelection.push(option);
            }
            return newSelection;
        });
    };

    const handleResetSelections = () => {
        setSelections({});
        setNotes('');
        setTakeawayCutlery([]);
        setTakeawayCutleryNotes('');
    };

    const handleConfirmClick = () => {
        if (!item) return;

        // Validation for required groups
        for (const group of item.optionGroups || []) {
            if (group.required && (!selections[group.id] || selections[group.id].length === 0)) {
                Swal.fire('ข้อมูลไม่ครบถ้วน', `กรุณาเลือกตัวเลือกสำหรับ "${group.name}"`, 'warning');
                return;
            }
        }
        
        const sortedOptionIds = selectedOptions.map(opt => opt.id).sort().join('-');
        const notesIdentifier = notes.trim().toLowerCase();
        
        let takeawayIdentifier = 'dinein';
        if (isTakeaway) {
            const cutleryIdentifier = [...takeawayCutlery].sort().join('-');
            const cutleryNotesIdentifier = takeawayCutlery.includes('other') ? (takeawayCutleryNotes || '').trim().toLowerCase() : '';
            takeawayIdentifier = `takeaway-${cutleryIdentifier}-${cutleryNotesIdentifier}`;
        }
        
        const cartItemId = `${item.id}-${sortedOptionIds}-${notesIdentifier}-${takeawayIdentifier}`;

        const itemToAdd: Partial<OrderItem> = {
            ...item,
            quantity: quantity,
            isTakeaway: isTakeaway,
            cartItemId: cartItemId,
            finalPrice: finalPrice,
            selectedOptions: selectedOptions,
            notes: notes.trim(),
        };
        
        if (isTakeaway) {
            itemToAdd.takeawayCutlery = takeawayCutlery;
            if (takeawayCutlery.includes('other')) {
                itemToAdd.takeawayCutleryNotes = takeawayCutleryNotes.trim();
            }
        }
        
        onConfirm(itemToAdd as OrderItem);
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b flex items-center gap-4 relative">
                    <MenuItemImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-20 h-20 rounded-md flex-shrink-0"
                    />
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">{item.name}</h3>
                        <p className="text-base text-gray-500">ราคาเริ่มต้น {item.price.toLocaleString()} ฿</p>
                    </div>
                    <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                
                <main className="p-6 space-y-6 overflow-y-auto flex-1">
                    {item.optionGroups?.map(group => (
                        <div key={group.id}>
                            <h4 className="text-lg font-semibold text-gray-800 border-b pb-1 mb-3">
                                {group.name} {group.nameEn && <span className="text-gray-500 font-normal text-sm">({group.nameEn})</span>} {group.required && <span className="text-red-500 text-sm">*</span>}
                            </h4>
                            <div className="space-y-2">
                                {group.options.map(option => {
                                    const isSelected = selections[group.id]?.some(o => o.id === option.id) ?? false;
                                    return (
                                        <div key={option.id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:bg-gray-50'}`} 
                                            onClick={() => group.selectionType === 'single' ? handleSingleSelect(group, option) : handleMultiSelect(group, option)}>
                                            {group.selectionType === 'single' ? (
                                                <input type="radio" checked={isSelected} readOnly className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"/>
                                            ) : (
                                                <input type="checkbox" checked={isSelected} readOnly className="h-5 w-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500"/>
                                            )}
                                            <span className="ml-3 flex-1 text-gray-800">
                                                {option.name} {option.nameEn && <span className="text-gray-500 text-sm">({option.nameEn})</span>}
                                            </span>
                                            {option.priceModifier > 0 && <span className="font-semibold text-gray-700">+ {option.priceModifier.toLocaleString()} ฿</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    <div className="pt-4 border-t">
                        <label htmlFor="item-notes" className="block text-lg font-semibold text-gray-800 mb-2">
                            หมายเหตุ (ถ้ามี):
                        </label>
                        <textarea
                            id="item-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="เช่น ไม่ใส่น้ำตาล, น้ำมันน้อย"
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                    </div>
                     {isTakeaway && (
                        <div className="pt-4 border-t">
                            <h4 className="text-lg font-semibold text-gray-800 mb-2">
                                รับเครื่องใช้
                            </h4>
                            <div className="space-y-2">
                                <label className="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                                    <input type="checkbox" checked={takeawayCutlery.includes('spoon-fork')} onChange={() => handleCutleryChange('spoon-fork')} className="h-5 w-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500"/>
                                    <span className="ml-3 flex-1 text-gray-800">รับช้อนส้อม</span>
                                </label>
                                <label className="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                                    <input type="checkbox" checked={takeawayCutlery.includes('chopsticks')} onChange={() => handleCutleryChange('chopsticks')} className="h-5 w-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500"/>
                                    <span className="ml-3 flex-1 text-gray-800">รับตะเกียบ</span>
                                </label>
                                <label className="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                                    <input type="checkbox" checked={takeawayCutlery.includes('other')} onChange={() => handleCutleryChange('other')} className="h-5 w-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500"/>
                                    <span className="ml-3 flex-1 text-gray-800">อื่นๆ (ระบุ)</span>
                                </label>
                                {takeawayCutlery.includes('other') && (
                                    <input 
                                        type="text" 
                                        value={takeawayCutleryNotes} 
                                        onChange={(e) => setTakeawayCutleryNotes(e.target.value)} 
                                        placeholder="ระบุ..."
                                        className="w-full p-2 ml-8 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                )}
                                 <label className="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                                    <input type="checkbox" checked={takeawayCutlery.includes('none')} onChange={() => handleCutleryChange('none')} className="h-5 w-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500"/>
                                    <span className="ml-3 flex-1 text-gray-800">ไม่รับ</span>
                                </label>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="bg-gray-50 px-6 py-4 flex justify-between items-center rounded-b-lg border-t">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-2xl font-bold flex items-center justify-center">-</button>
                        <span className="text-3xl font-bold w-12 text-center text-gray-900">{quantity}</span>
                        <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-2xl font-bold flex items-center justify-center">+</button>
                        <button type="button" onClick={handleResetSelections} className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 font-semibold" title="ล้างที่เลือก">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                         <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                            <input type="checkbox" checked={isTakeaway} onChange={(e) => setIsTakeaway(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                            <span className="font-semibold text-sm">สั่งกลับบ้าน</span>
                        </label>
                        <button 
                            onClick={handleConfirmClick}
                            className="px-4 sm:px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-base sm:text-lg flex items-center justify-center"
                        >
                            <span>{orderItemToEdit ? 'บันทึกการแก้ไข' : 'เพิ่มOrder'}</span>
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};