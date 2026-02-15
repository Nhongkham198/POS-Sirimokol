
import React, { useState, useEffect, useMemo } from 'react';
import type { MenuItem, MenuOption, MenuOptionGroup } from '../types';
import Swal from 'sweetalert2';

interface MenuItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Omit<MenuItem, 'id'> & { id?: number }) => void;
    itemToEdit: MenuItem | null;
    categories: any[];
    onAddCategory: (name: string) => void;
}

const initialFormState: Omit<MenuItem, 'id'> = {
    name: '',
    nameEn: '', // Added English name
    price: 0,
    category: '',
    imageUrl: '',
    cookingTime: 15,
    optionGroups: [],
};

export const MenuItemModal: React.FC<MenuItemModalProps> = ({ isOpen, onClose, onSave, itemToEdit, categories, onAddCategory }) => {
    const [formState, setFormState] = useState(initialFormState);
    const [priceString, setPriceString] = useState('0');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const normalizedCategories = useMemo(() => {
        if (!Array.isArray(categories)) return [];
        return categories.map(cat => {
            if (typeof cat === 'object' && cat !== null && 'name' in cat && typeof (cat as any).name === 'string') {
                return (cat as any).name;
            }
            if (typeof cat === 'string') {
                return cat;
            }
            return null;
        }).filter((catName): catName is string => typeof catName === 'string');
    }, [categories]);


    useEffect(() => {
        if (isOpen) {
            setIsAddingCategory(false);
            setNewCategoryName('');
            if (itemToEdit) {
                setFormState({ 
                    ...itemToEdit, 
                    nameEn: itemToEdit.nameEn || '', // Handle edit case
                    cookingTime: itemToEdit.cookingTime ?? 15,
                    optionGroups: JSON.parse(JSON.stringify(itemToEdit.optionGroups || [])) 
                });
                setPriceString(String(itemToEdit.price));
            } else {
                setFormState({ ...initialFormState, category: normalizedCategories.find(c => c !== 'ทั้งหมด') || '', optionGroups: [] });
                setPriceString('0');
            }
        }
    }, [isOpen, itemToEdit, normalizedCategories]);

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow empty string, numbers, and a single decimal point
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
            setPriceString(val);
            setFormState(prev => ({ ...prev, price: parseFloat(val) || 0 }));
        }
    };

    const handleAddCategoryClick = () => {
        const trimmedName = newCategoryName.trim();
        if (trimmedName && !normalizedCategories.includes(trimmedName)) {
            onAddCategory(trimmedName);
            setFormState(prev => ({ ...prev, category: trimmedName }));
            setNewCategoryName('');
            setIsAddingCategory(false);
        } else if (trimmedName) {
            Swal.fire('มีอยู่แล้ว', 'หมวดหมู่นี้มีอยู่แล้ว', 'warning');
        }
    };
    
    // --- Option Groups Logic ---
    const handleAddGroup = () => {
        const newGroup: MenuOptionGroup = {
            id: `group_${Date.now()}`,
            name: '',
            nameEn: '',
            selectionType: 'single',
            required: false,
            options: []
        };
        setFormState(prev => ({ ...prev, optionGroups: [...(prev.optionGroups || []), newGroup] }));
    };

    const handleGroupChange = (groupIndex: number, field: keyof MenuOptionGroup, value: any) => {
        setFormState(prev => {
            const newGroups = JSON.parse(JSON.stringify(prev.optionGroups || []));
            (newGroups[groupIndex] as any)[field] = value;
            return { ...prev, optionGroups: newGroups };
        });
    };

    const handleDeleteGroup = (groupIndex: number) => {
        setFormState(prev => ({ ...prev, optionGroups: (prev.optionGroups || []).filter((_, i) => i !== groupIndex) }));
    };

    const handleAddOption = (groupIndex: number) => {
        const newOption: MenuOption = { id: `option_${Date.now()}`, name: '', nameEn: '', priceModifier: 0, isDefault: false };
        setFormState(prev => {
            const newGroups = JSON.parse(JSON.stringify(prev.optionGroups || []));
            newGroups[groupIndex].options.push(newOption);
            return { ...prev, optionGroups: newGroups };
        });
    };
    
    const handleOptionChange = (groupIndex: number, optionIndex: number, field: keyof MenuOption, value: any) => {
        setFormState(prev => {
            const newGroups = JSON.parse(JSON.stringify(prev.optionGroups || []));
            const option = newGroups[groupIndex].options[optionIndex];
            (option as any)[field] = value;

            // If setting an option as default in a single-select group, unset others.
            if (field === 'isDefault' && value === true && newGroups[groupIndex].selectionType === 'single') {
                 newGroups[groupIndex].options.forEach((opt: MenuOption, i: number) => {
                    if (i !== optionIndex) opt.isDefault = false;
                });
            }

            return { ...prev, optionGroups: newGroups };
        });
    };

    const handleDeleteOption = (groupIndex: number, optionIndex: number) => {
        setFormState(prev => {
            const newGroups = JSON.parse(JSON.stringify(prev.optionGroups || []));
            newGroups[groupIndex].options = newGroups[groupIndex].options.filter((_: any, i: number) => i !== optionIndex);
            return { ...prev, optionGroups: newGroups };
        });
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name || priceString === '' || formState.price < 0 || !formState.category) {
            Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อ, ราคา, และหมวดหมู่ให้ถูกต้อง', 'warning');
            return;
        }

        const cleanedGroups = (formState.optionGroups || [])
            .map(group => ({
                ...group,
                options: group.options.filter(opt => opt.name.trim() !== '')
            }))
            .filter(group => group.name.trim() !== '' && group.options.length > 0);

        onSave({ ...formState, optionGroups: cleanedGroups });
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
    const smallInputClasses = "w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold p-6 border-b text-gray-800 flex-shrink-0">{itemToEdit ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}</h2>
                <form id="menu-item-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-4">
                        {/* Basic Info */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ชื่อเมนู</label>
                            <input type="text" value={formState.name} onChange={(e) => setFormState(prev => ({...prev, name: e.target.value}))} className={inputClasses} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ชื่อภาษาอังกฤษ (Optional)</label>
                            <input type="text" value={formState.nameEn} onChange={(e) => setFormState(prev => ({...prev, nameEn: e.target.value}))} className={inputClasses} placeholder="English Name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ราคา (บาท)</label>
                            <input type="text" inputMode="decimal" value={priceString} onChange={handlePriceChange} className={inputClasses} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">หมวดหมู่</label>
                            {isAddingCategory ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategoryClick()} placeholder="ชื่อหมวดหมู่ใหม่" className="flex-grow p-2 border border-gray-300 rounded-md" autoFocus />
                                    <button type="button" onClick={handleAddCategoryClick} className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">เพิ่ม</button>
                                    <button type="button" onClick={() => setIsAddingCategory(false)} className="px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">ยกเลิก</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mt-1">
                                    <select value={formState.category} onChange={(e) => setFormState(prev => ({...prev, category: e.target.value}))} className={`${inputClasses} mt-0 flex-grow`} required>
                                        <option value="" disabled>-- เลือกหมวดหมู่ --</option>
                                        {normalizedCategories.filter(c => c !== 'ทั้งหมด').map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                    <button type="button" onClick={() => setIsAddingCategory(true)} className="px-3 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 h-[42px]">+</button>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Image URL</label>
                            <input type="text" value={formState.imageUrl} onChange={(e) => setFormState(prev => ({...prev, imageUrl: e.target.value}))} className={inputClasses} placeholder="https://..." />
                        </div>

                        {/* Option Groups */}
                        <div className="pt-4 border-t">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">ตัวเลือกเสริม</h3>
                            <div className="space-y-4">
                                {(formState.optionGroups || []).map((group, groupIndex) => (
                                    <div key={group.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                            <div className="space-y-2">
                                                <input type="text" placeholder="ชื่อกลุ่ม (เช่น ประเภทเนื้อ)" value={group.name} onChange={(e) => handleGroupChange(groupIndex, 'name', e.target.value)} className={smallInputClasses} />
                                                <input type="text" placeholder="ชื่อกลุ่ม Eng (Optional)" value={group.nameEn || ''} onChange={(e) => handleGroupChange(groupIndex, 'nameEn', e.target.value)} className={smallInputClasses} />
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <select value={group.selectionType} onChange={(e) => handleGroupChange(groupIndex, 'selectionType', e.target.value)} className={smallInputClasses}>
                                                    <option value="single">เลือกได้ 1 อย่าง</option>
                                                    <option value="multiple">เลือกได้หลายอย่าง</option>
                                                </select>
                                                <button type="button" onClick={() => handleDeleteGroup(groupIndex)} className="p-2 text-red-500 hover:bg-red-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={group.required} onChange={(e) => handleGroupChange(groupIndex, 'required', e.target.checked)} className="rounded"/>บังคับเลือก</label>
                                        
                                        <div className="pl-4 border-l-2 border-gray-200 space-y-2">
                                            {group.options.map((option, optionIndex) => (
                                                <div key={option.id} className="flex items-center gap-2">
                                                    <input type="text" placeholder="ชื่อตัวเลือก (เช่น ไก่)" value={option.name} onChange={e => handleOptionChange(groupIndex, optionIndex, 'name', e.target.value)} className={`${smallInputClasses} flex-1`} />
                                                    <input type="text" placeholder="Eng (Opt)" value={option.nameEn || ''} onChange={e => handleOptionChange(groupIndex, optionIndex, 'nameEn', e.target.value)} className={`${smallInputClasses} flex-1`} />
                                                    <input type="number" placeholder="ราคาเพิ่ม" value={option.priceModifier} onChange={e => handleOptionChange(groupIndex, optionIndex, 'priceModifier', Number(e.target.value))} className={`${smallInputClasses} w-20`} />
                                                    <label className="flex items-center gap-1.5 text-xs text-gray-500" title="ตั้งเป็นค่าเริ่มต้น"><input type="checkbox" checked={option.isDefault} onChange={e => handleOptionChange(groupIndex, optionIndex, 'isDefault', e.target.checked)} className="rounded" />Default</label>
                                                    <button type="button" onClick={() => handleDeleteOption(groupIndex, optionIndex)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full">&times;</button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => handleAddOption(groupIndex)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 mt-2">+ เพิ่มตัวเลือก</button>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddGroup} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition-colors">+ เพิ่มกลุ่มตัวเลือก</button>
                            </div>
                        </div>
                    </div>
                </form>
                <div className="flex-shrink-0 flex justify-end gap-2 p-4 bg-gray-50 border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">ยกเลิก</button>
                    <button type="submit" form="menu-item-form" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">บันทึก</button>
                </div>
            </div>
        </div>
    );
};