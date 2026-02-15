
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { MenuItem } from '../types';
import { MenuItemCard } from './MenuItem';
import Swal from 'sweetalert2';
import { ThaiVirtualKeyboard } from './ThaiVirtualKeyboard';

declare var XLSX: any;

interface MenuProps {
    menuItems: MenuItem[];
    setMenuItems: (items: MenuItem[]) => void;
    categories: any[];
    onSelectItem: (item: MenuItem) => void;
    isEditMode: boolean;
    onEditItem: (item: MenuItem) => void;
    onAddNewItem: () => void;
    onDeleteItem: (id: number) => void;
    onUpdateCategory: (oldName: string, newName: string) => void;
    onDeleteCategory: (name: string) => void;
    onAddCategory: (name: string) => void;
    onImportMenu: (importedItems: MenuItem[], newCategories: string[]) => void;
    recommendedMenuItemIds: number[];
    onToggleVisibility?: (id: number) => void;
    hideCategories?: boolean;
    title?: string;
    searchPlaceholder?: string;
    // New Props for Sidebar Toggle
    onToggleOrderSidebar?: () => void;
    isOrderSidebarVisible?: boolean;
    cartItemCount?: number;
}

export const Menu: React.FC<MenuProps> = ({ 
    menuItems, 
    setMenuItems,
    categories, 
    onSelectItem, 
    isEditMode, 
    onEditItem,
    onAddNewItem,
    onDeleteItem, 
    onUpdateCategory, 
    onDeleteCategory, 
    onAddCategory, 
    onImportMenu,
    recommendedMenuItemIds,
    onToggleVisibility,
    hideCategories = false,
    title = 'เมนูอาหาร',
    searchPlaceholder = 'ค้นหาเมนู...',
    onToggleOrderSidebar,
    isOrderSidebarVisible,
    cartItemCount = 0
}) => {
    const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    const categoryScrollRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);
    
    // --- Keyboard State ---
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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
        if (normalizedCategories.length === 0) return;
        if (!normalizedCategories.includes(selectedCategory)) {
            if (selectedCategory === 'ทั้งหมด' && normalizedCategories.includes('All')) {
                setSelectedCategory('All');
            } else if (selectedCategory === 'All' && normalizedCategories.includes('ทั้งหมด')) {
                setSelectedCategory('ทั้งหมด');
            } else {
                if (normalizedCategories.length > 0) {
                    setSelectedCategory(normalizedCategories[0]);
                }
            }
        }
    }, [categories, normalizedCategories, selectedCategory]);

    const handleDragSort = () => {
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
            return;
        }

        const dragItemId = dragItem.current;
        const dragOverItemId = dragOverItem.current;

        const _menuItems = [...menuItems];

        const dragItemIndex = _menuItems.findIndex(item => item.id === dragItemId);
        const dragOverItemIndex = _menuItems.findIndex(item => item.id === dragOverItemId);

        if (dragItemIndex === -1 || dragOverItemIndex === -1) {
            return;
        }

        const draggedItemContent = _menuItems.splice(dragItemIndex, 1)[0];
        _menuItems.splice(dragOverItemIndex, 0, draggedItemContent);

        dragItem.current = null;
        dragOverItem.current = null;

        setMenuItems(_menuItems);
    };

    // --- Category Scroller Logic ---
    const debounce = (func: () => void, delay: number) => {
        let timeout: number;
        return () => {
            clearTimeout(timeout);
            timeout = window.setTimeout(func, delay);
        };
    };

    const checkCategoryScroll = () => {
        const el = categoryScrollRef.current;
        if (el) {
            const hasOverflow = el.scrollWidth > el.clientWidth;
            setShowLeftArrow(hasOverflow && el.scrollLeft > 5);
            setShowRightArrow(hasOverflow && el.scrollWidth - el.clientWidth - el.scrollLeft > 5);
        }
    };
    
    useEffect(() => {
        const el = categoryScrollRef.current;
        if (el && !hideCategories) {
            const debouncedCheck = debounce(checkCategoryScroll, 100);
            checkCategoryScroll();
            window.addEventListener('resize', debouncedCheck);
            el.addEventListener('scroll', debouncedCheck);
            const observer = new MutationObserver(debouncedCheck);
            observer.observe(el, { childList: true, subtree: true });

            return () => {
                window.removeEventListener('resize', debouncedCheck);
                el.removeEventListener('scroll', debouncedCheck);
                observer.disconnect();
            };
        }
    }, [categories, hideCategories]);

    const scrollCategories = (direction: 'left' | 'right') => {
        const el = categoryScrollRef.current;
        if (el) {
            const scrollAmount = (el.clientWidth * 0.8) * (direction === 'left' ? -1 : 1);
            el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const filteredItems = useMemo(() => {
        if (hideCategories) {
             if (searchTerm.trim()) {
                const searchParts = searchTerm.toLowerCase().trim().split(/\s+/);
                return menuItems.filter(item => 
                    searchParts.every(part => item.name.toLowerCase().includes(part))
                );
            }
            return menuItems;
        }

        const isSelectedValid = normalizedCategories.includes(selectedCategory);
        let effectiveCategory = selectedCategory;
        
        if (!isSelectedValid) {
             if (selectedCategory === 'ทั้งหมด' && normalizedCategories.includes('All')) {
                 effectiveCategory = 'All';
             } else if (selectedCategory === 'All' && normalizedCategories.includes('ทั้งหมด')) {
                 effectiveCategory = 'ทั้งหมด';
             } else if (normalizedCategories.length > 0) {
                 effectiveCategory = normalizedCategories[0];
             }
        }

        if (searchTerm.trim()) {
            const searchParts = searchTerm.toLowerCase().trim().split(/\s+/);
            return menuItems.filter(item => 
                searchParts.every(part => item.name.toLowerCase().includes(part))
            );
        }

        if (effectiveCategory === 'ทั้งหมด' || effectiveCategory === 'All') {
            return menuItems;
        }
        
        return menuItems.filter(item => item.category === effectiveCategory);

    }, [menuItems, selectedCategory, searchTerm, normalizedCategories, hideCategories]);
    
    const handleEditCategory = (categoryName: string) => {
        Swal.fire({
            title: 'แก้ไขชื่อหมวดหมู่',
            input: 'text',
            inputValue: categoryName,
            showCancelButton: true,
            confirmButtonText: 'บันทึก',
            cancelButtonText: 'ยกเลิก',
            inputValidator: (value) => {
                if (!value) {
                    return 'กรุณาใส่ชื่อหมวดหมู่!'
                }
                if (categories.some(c => c.toLowerCase() === value.toLowerCase() && c.toLowerCase() !== categoryName.toLowerCase())) {
                    return 'หมวดหมู่นี้มีอยู่แล้ว!'
                }
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const newName = result.value.trim();
                if (newName && newName !== categoryName) {
                    onUpdateCategory(categoryName, newName);
                }
            }
        });
    };
    
    const handleDeleteCategory = (categoryName: string) => {
        const isInUse = menuItems.some(item => item.category === categoryName);

        const config = {
            title: `ลบหมวดหมู่ "${categoryName}"?`,
            icon: 'warning' as const,
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'ใช่, ลบเลย',
            cancelButtonText: 'ยกเลิก',
            html: isInUse
                ? `หมวดหมู่นี้มีเมนูใช้งานอยู่ เมนูในหมวดหมู่นี้จะไม่ถูกลบ แต่จะไม่แสดงภายใต้หมวดหมู่นี้อีกต่อไป (จะยังคงเห็นได้ใน "ทั้งหมด")<br/><strong>คุณต้องการลบต่อไปหรือไม่?</strong>`
                : "การกระทำนี้ไม่สามารถย้อนกลับได้"
        };
        
        Swal.fire(config).then((result) => {
            if (result.isConfirmed) {
                onDeleteCategory(categoryName);
                if (selectedCategory === categoryName) {
                    setSelectedCategory('ทั้งหมด');
                }
            }
        });
    };

    const handleAddCategory = () => {
        Swal.fire({
            title: 'เพิ่มหมวดหมู่ใหม่',
            input: 'text',
            inputPlaceholder: 'ชื่อหมวดหมู่ใหม่',
            showCancelButton: true,
            confirmButtonText: 'เพิ่ม',
            cancelButtonText: 'ยกเลิก',
            inputValidator: (value) => {
                if (!value) {
                    return 'กรุณาใส่ชื่อหมวดหมู่!'
                }
                if (categories.some(c => c.toLowerCase() === value.toLowerCase())) {
                    return 'หมวดหมู่นี้มีอยู่แล้ว!'
                }
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const newName = result.value.trim();
                if (newName) {
                    onAddCategory(newName);
                }
            }
        });
    };

    const handleExportMenu = () => {
        const dataToExport: any[] = [];
        menuItems.forEach(item => {
            if (!item.optionGroups || item.optionGroups.length === 0) {
                dataToExport.push({
                    'id': item.id,
                    'name': item.name,
                    'price': item.price,
                    'category': item.category,
                    'image_url': item.imageUrl,
                    'cooking_time': item.cookingTime || '',
                    'is_available': item.isAvailable !== false ? 'TRUE' : 'FALSE',
                    'option_group_name': '',
                    'option_group_type': '',
                    'option_group_required': '',
                    'option_name': '',
                    'option_price_modifier': '',
                    'option_is_default': ''
                });
            } else {
                item.optionGroups.forEach(group => {
                    if (group.options.length === 0) {
                         dataToExport.push({
                            'id': item.id,
                            'name': item.name,
                            'price': item.price,
                            'category': item.category,
                            'image_url': item.imageUrl,
                            'cooking_time': item.cookingTime || '',
                            'is_available': item.isAvailable !== false ? 'TRUE' : 'FALSE',
                            'option_group_name': group.name,
                            'option_group_type': group.selectionType,
                            'option_group_required': group.required ? 'TRUE' : 'FALSE',
                            'option_name': '',
                            'option_price_modifier': '',
                            'option_is_default': ''
                        });
                    } else {
                        group.options.forEach(option => {
                            dataToExport.push({
                                'id': item.id,
                                'name': item.name,
                                'price': item.price,
                                'category': item.category,
                                'image_url': item.imageUrl,
                                'cooking_time': item.cookingTime || '',
                                'is_available': item.isAvailable !== false ? 'TRUE' : 'FALSE',
                                'option_group_name': group.name,
                                'option_group_type': group.selectionType,
                                'option_group_required': group.required ? 'TRUE' : 'FALSE',
                                'option_name': option.name,
                                'option_price_modifier': option.priceModifier,
                                'option_is_default': option.isDefault ? 'TRUE' : 'FALSE'
                            });
                        });
                    }
                });
            }
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MenuItems");
        XLSX.writeFile(wb, "menu_export.xlsx");
    };

    const handleImportMenu = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);
    
                if (json.length === 0) {
                    Swal.fire('ไฟล์ว่าง', 'ไฟล์ Excel ที่เลือกไม่มีข้อมูล', 'warning');
                    return;
                }
    
                const menuItemsMap = new Map<number, MenuItem>();
                const newCategories = new Set<string>();
                let errorCount = 0;
    
                for (const row of json) {
                    const id = Number(row.id);
                    if (isNaN(id) || !row.name || row.price === undefined || !row.category) {
                        errorCount++;
                        continue; // Skip rows with essential missing data
                    }
    
                    newCategories.add(row.category);
    
                    if (!menuItemsMap.has(id)) {
                        menuItemsMap.set(id, {
                            id: id,
                            name: String(row.name),
                            price: Number(row.price),
                            category: String(row.category),
                            imageUrl: String(row.image_url || ''),
                            cookingTime: row.cooking_time ? Number(row.cooking_time) : undefined,
                            isAvailable: row.is_available === 'FALSE' ? false : true,
                            optionGroups: [],
                        });
                    }
    
                    const menuItem = menuItemsMap.get(id)!;
    
                    if (row.option_group_name) {
                        let group = menuItem.optionGroups?.find(g => g.name === row.option_group_name);
                        if (!group) {
                            group = {
                                id: `group_${id}_${menuItem.optionGroups!.length}`,
                                name: String(row.option_group_name),
                                selectionType: row.option_group_type === 'multiple' ? 'multiple' : 'single',
                                required: String(row.option_group_required).toUpperCase() === 'TRUE',
                                options: []
                            };
                            menuItem.optionGroups!.push(group);
                        }
    
                        if (row.option_name) {
                            const optionExists = group.options.some(o => o.name === row.option_name);
                            if (!optionExists) {
                                 group.options.push({
                                    id: `option_${id}_${group.id}_${group.options.length}`,
                                    name: String(row.option_name),
                                    priceModifier: Number(row.option_price_modifier || 0),
                                    isDefault: String(row.option_is_default).toUpperCase() === 'TRUE',
                                });
                            }
                        }
                    }
                }
    
                const importedCount = menuItemsMap.size;
                const importedItems = Array.from(menuItemsMap.values());
                
                if (importedCount > 0) {
                    onImportMenu(importedItems, Array.from(newCategories));
                    Swal.fire({
                        title: 'นำเข้าสำเร็จ',
                        html: `นำเข้า/อัปเดตเมนู ${importedCount} รายการเรียบร้อยแล้ว<br/>พบข้อมูลที่ไม่ถูกต้อง ${errorCount} แถว`,
                        icon: 'success'
                    });
                } else {
                     Swal.fire('นำเข้าไม่สำเร็จ', `ไม่พบข้อมูลเมนูที่ถูกต้องในไฟล์ พบข้อมูลที่ไม่ถูกต้อง ${errorCount} แถว`, 'error');
                }
    
            } catch (error) {
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ Excel ได้ กรุณาตรวจสอบรูปแบบไฟล์', 'error');
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleToggleAvailability = (id: number) => {
        const updated = menuItems.map(i => i.id === id ? { ...i, isAvailable: i.isAvailable === false ? true : false } : i);
        setMenuItems(updated);
    };

    const handleVirtualKeyPress = (key: string) => {
        setSearchTerm(prev => prev + key);
    };

    const handleVirtualBackspace = () => {
        setSearchTerm(prev => prev.slice(0, -1));
    };

    const handleVirtualClear = () => {
        setSearchTerm('');
    };

    const isSelectedValid = normalizedCategories.includes(selectedCategory);
    let effectiveCategoryForUI = selectedCategory;
    
    if (!isSelectedValid) {
            if (selectedCategory === 'ทั้งหมด' && normalizedCategories.includes('All')) {
                effectiveCategoryForUI = 'All';
            } else if (selectedCategory === 'All' && normalizedCategories.includes('ทั้งหมด')) {
                effectiveCategoryForUI = 'ทั้งหมด';
            } else if (normalizedCategories.length > 0) {
                effectiveCategoryForUI = normalizedCategories[0];
            }
    }

    return (
        <div className="flex flex-col bg-white p-4 rounded-lg shadow-sm h-full relative">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportMenu}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
            />
            {/* Header and Search */}
            <div className="mb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                <div className="mt-2 flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    <div className={`relative ${hideCategories ? 'w-full' : 'w-full md:w-auto'} flex gap-2`}>
                         <div className="relative flex-1">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full ${hideCategories ? '' : 'md:w-64'} pl-10 pr-12 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-900`}
                            />
                            <button 
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-blue-600 transition-colors"
                                onClick={() => setIsKeyboardOpen(!isKeyboardOpen)}
                                title={isKeyboardOpen ? "ปิดแป้นพิมพ์" : "เปิดแป้นพิมพ์ไทย"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                         </div>
                    </div>
                    
                    {!hideCategories && (
                        <div className="flex-1 overflow-hidden relative w-full">
                            {showLeftArrow && (
                                <button
                                    onClick={() => scrollCategories('left')}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm text-gray-700 rounded-full w-8 h-8 flex items-center justify-center z-10 shadow-md hover:bg-gray-100 border border-gray-200"
                                    aria-label="Scroll categories left"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                            )}
                            <div 
                                ref={categoryScrollRef}
                                className="flex overflow-x-auto whitespace-nowrap gap-2 items-center py-2 custom-scrollbar"
                            >
                                {normalizedCategories.map(category => (
                                    <div key={category} className="relative group flex-shrink-0">
                                        <button
                                            onClick={() => setSelectedCategory(category)}
                                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                                                effectiveCategoryForUI === category
                                                    ? 'bg-blue-600 text-white shadow'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                        >
                                            {category}
                                        </button>
                                        {isEditMode && category !== 'ทั้งหมด' && category !== 'All' && (
                                            <div className="absolute -top-2 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <button onClick={() => handleEditCategory(category)} className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-200">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                                </button>
                                                <button onClick={() => handleDeleteCategory(category)} className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-200">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isEditMode && (
                                    <>
                                        <button
                                            onClick={handleAddCategory}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-full hover:bg-green-600 transition-colors text-sm flex-shrink-0"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                            </svg>
                                            <span>เพิ่มหมวดหมู่</span>
                                        </button>
                                        <button
                                            onClick={handleExportMenu}
                                            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white font-semibold rounded-full hover:bg-teal-600 transition-colors text-sm flex-shrink-0"
                                        >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <span>ดึงข้อมูลเมนู</span>
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white font-semibold rounded-full hover:bg-purple-600 transition-colors text-sm flex-shrink-0"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            <span>นำเข้าข้อมูลเมนู</span>
                                        </button>
                                    </>
                                )}
                            </div>
                            {showRightArrow && (
                                <button
                                    onClick={() => scrollCategories('right')}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm text-gray-700 rounded-full w-8 h-8 flex items-center justify-center z-10 shadow-md hover:bg-gray-100 border border-gray-200"
                                    aria-label="Scroll categories right"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Menu Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 content-start pb-4">
                {isEditMode && (
                    <div
                        onClick={onAddNewItem}
                        className="relative group bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-blue-400 transition-all h-64"
                    >
                        <div className="text-gray-400 group-hover:text-blue-500 transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <p className="mt-2 font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">เพิ่มเมนูใหม่</p>
                    </div>
                )}
                {filteredItems.map(item => (
                    <MenuItemCard
                        key={item.id}
                        item={item}
                        onSelectItem={onSelectItem}
                        isEditMode={isEditMode}
                        onEdit={onEditItem}
                        onDelete={onDeleteItem}
                        onDragStart={() => (dragItem.current = item.id)}
                        onDragEnter={() => (dragOverItem.current = item.id)}
                        onDragEnd={handleDragSort}
                        isRecommended={recommendedMenuItemIds.includes(item.id)}
                        onToggleAvailability={() => handleToggleAvailability(item.id)}
                        onToggleVisibility={() => onToggleVisibility && onToggleVisibility(item.id)}
                    />
                ))}
            </div>

            {/* SIDEBAR TOGGLE BUTTON - MOVED & STYLED AS REQUESTED */}
            {onToggleOrderSidebar && (
                <button
                    onClick={onToggleOrderSidebar}
                    className={`absolute right-0 top-1/4 z-20 
                                bg-blue-600 border-l-2 border-t-2 border-b-2 border-white shadow-xl 
                                p-0 rounded-l-xl text-white hover:bg-blue-700 transition-all 
                                flex items-center justify-center h-24 w-10
                                focus:outline-none`}
                    title={isOrderSidebarVisible ? "ซ่อนรายการ" : "แสดงรายการ"}
                >
                    <div className="relative flex items-center justify-center w-full h-full">
                        {/* Arrow Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 transition-transform ${isOrderSidebarVisible ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        
                        {/* Badge: Top Left, Bigger */}
                        {cartItemCount > 0 && (
                            <span className="absolute -top-4 -left-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white shadow-lg border-2 border-white animate-bounce z-30">
                                {cartItemCount > 99 ? '99+' : cartItemCount}
                            </span>
                        )}
                    </div>
                </button>
            )}

            {/* Virtual Keyboard Overlay */}
            {isKeyboardOpen && (
                <ThaiVirtualKeyboard 
                    onKeyPress={handleVirtualKeyPress}
                    onBackspace={handleVirtualBackspace}
                    onClear={handleVirtualClear}
                    onClose={() => setIsKeyboardOpen(false)}
                />
            )}
        </div>
    );
};
