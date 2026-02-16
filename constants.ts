
import type { MenuItem, Table, Branch, User, StockItem, MaintenanceItem, DeliveryProvider } from './types';

export const DEFAULT_BRANCHES: Branch[] = [
    { id: 1, name: 'ร้านอาหาร (สาขาหลัก)', location: 'Main Branch' }
];

export const DEFAULT_USERS: User[] = [
    { id: 1, username: 'admin', password: 'password', role: 'admin' },
    { id: 2, username: 'pos', password: 'password', role: 'pos', allowedBranchIds: [1] },
    { id: 3, username: 'kitchen', password: 'password', role: 'kitchen', allowedBranchIds: [1] },
    { id: 4, username: 'manager', password: 'password', role: 'branch-admin', allowedBranchIds: [1] },
    { id: 5, username: 'Sam', password: '198', role: 'admin' },
    { id: 6, username: 'auditor', password: 'password', role: 'auditor', allowedBranchIds: [1] },
];

export const DEFAULT_DELIVERY_PROVIDERS: DeliveryProvider[] = [
    { 
        id: 'lineman', 
        name: 'LineMan', 
        iconUrl: 'https://play-lh.googleusercontent.com/9t-Q8WmwJ8zXjHhEAgqM5f5zZk3G7y7yX9y3y3y3y3y3y3y3y3y3y3y3y3y3y3', 
        color: '#10b981', // Green
        isEnabled: true,
        isDefault: true 
    },
    { 
        id: 'shopeefood', 
        name: 'ShopeeFood', 
        iconUrl: 'https://play-lh.googleusercontent.com/1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1-1', 
        color: '#f97316', // Orange
        isEnabled: false,
        isDefault: true 
    },
    { 
        id: 'grabfood', 
        name: 'GrabFood', 
        iconUrl: '', 
        color: '#22c55e', // Green
        isEnabled: false,
        isDefault: true 
    },
    { 
        id: 'robinhood', 
        name: 'Robinhood', 
        iconUrl: '', 
        color: '#a855f7', // Purple
        isEnabled: false,
        isDefault: true 
    }
];

// Empty Array: Forces the app to fetch from DB or show nothing.
export const DEFAULT_MENU_ITEMS: MenuItem[] = [];

export const DEFAULT_FLOORS: string[] = ['ชั้นล่าง', 'ชั้นบน'];

export const DEFAULT_TABLES: Table[] = [
    { id: 1, name: 'T1', floor: 'ชั้นล่าง', activePin: null, reservation: null },
    { id: 2, name: 'T2', floor: 'ชั้นล่าง', activePin: null, reservation: null },
    { id: 3, name: 'T3', floor: 'ชั้นล่าง', activePin: null, reservation: null },
    { id: 4, name: 'T1', floor: 'ชั้นบน', activePin: null, reservation: null },
    { id: 5, name: 'T2', floor: 'ชั้นบน', activePin: null, reservation: null },
    { id: 6, name: 'T3', floor: 'ชั้นบน', activePin: null, reservation: null },
];

export const DEFAULT_CATEGORIES: string[] = ['ทั้งหมด', 'อาหารจานเดียว', 'อาหารเกาหลี', 'ของทานเล่น', 'เครื่องดื่ม'];
export const DEFAULT_STOCK_CATEGORIES: string[] = ['ทั้งหมด', 'ของสด', 'ของแห้ง', 'เครื่องปรุง', 'เครื่องดื่ม'];
export const DEFAULT_STOCK_UNITS: string[] = ['กิโลกรัม', 'ลิตร', 'ขวด', 'แพ็ค', 'ชิ้น', 'ฟอง', 'ถุง'];

// Empty Stock Items
export const DEFAULT_STOCK_ITEMS: StockItem[] = [];

export const DEFAULT_MAINTENANCE_ITEMS: MaintenanceItem[] = [
    {
        id: 1,
        name: 'เครื่องทำน้ำแข็ง (Ice Machine)',
        description: 'ทำความสะอาดแผ่นกรองและถังเก็บน้ำแข็ง',
        imageUrl: 'https://images.unsplash.com/photo-1595427339879-19c99c372c3d?q=80&w=300&auto=format&fit=crop',
        cycleMonths: 1,
        lastMaintenanceDate: Date.now(),
        status: 'active'
    }
];
