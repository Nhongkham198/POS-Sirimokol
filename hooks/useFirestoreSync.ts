
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/firebaseConfig';
import type { Table } from '@/types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import Swal from 'sweetalert2';

// Hook for Single Document Sync (Legacy/Config/Arrays)
export function useFirestoreSync<T>(
    branchId: string | null,
    collectionKey: string,
    initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(initialValue);
    const initialValueRef = useRef(initialValue);
    
    // Keep a ref to the current value to avoid stale closures
    const valueRef = useRef(value);
    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        if (!db) {
            console.error("Firestore is not initialized.");
            return () => {};
        }

        // Define keys that should be global (not nested under a branch)
        // These settings need to be available before a branch is selected (e.g., Login screen)
        // or shared across all branches.
        const globalKeys = [
            'users', 
            'branches', 
            'leaveRequests', 
            'appLogoUrl', 
            'logoUrl', 
            'restaurantName', 
            'restaurantAddress', 
            'restaurantPhone', 
            'taxId', 
            'qrCodeUrl',
            'signatureUrl',
            'notificationSoundUrl',
            'staffCallSoundUrl'
        ];

        const isBranchSpecific = !globalKeys.includes(collectionKey);
        const currentInitialValue = initialValueRef.current;

        if (isBranchSpecific && !branchId) {
            setValue(currentInitialValue);
            return () => {};
        }

        const pathSegments = isBranchSpecific && branchId
            ? ['branches', branchId, collectionKey, 'data']
            : [collectionKey, 'data'];
        
        const docRef = db.doc(pathSegments.join('/'));

        const unsubscribe = docRef.onSnapshot(
            { includeMetadataChanges: true }, 
            (docSnapshot) => {
                if (docSnapshot.exists) {
                    const data = docSnapshot.data();
                    if (data && typeof data.value !== 'undefined') {
                        let valueToSet = data.value;

                        // --- Validation & Cleanup Logic ---
                        if (collectionKey === 'tables' && Array.isArray(valueToSet)) {
                            const rawTablesFromDb = valueToSet as Table[];
                            const uniqueTablesMap = new Map<number, Table>();
                            rawTablesFromDb.forEach(table => {
                                if (table && typeof table.id === 'number') {
                                    if (!uniqueTablesMap.has(table.id)) {
                                        uniqueTablesMap.set(table.id, table);
                                    }
                                }
                            });
                            valueToSet = Array.from(uniqueTablesMap.values());
                        } 
                        else if (collectionKey === 'orderCounter') {
                            const counterData = valueToSet as any;
                            if (!counterData || typeof counterData !== 'object' || typeof counterData.count !== 'number') {
                                setValue(currentInitialValue);
                                return;
                            }
                            const { count, lastResetDate } = counterData;
                            let correctedDateString = '';
                            if (typeof lastResetDate === 'string') {
                                correctedDateString = lastResetDate;
                            } else if (lastResetDate && typeof lastResetDate.toDate === 'function') {
                                const dateObj = lastResetDate.toDate();
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                correctedDateString = `${year}-${month}-${day}`;
                            }
                            if (correctedDateString) {
                                valueToSet = { count, lastResetDate: correctedDateString };
                            } else {
                                setValue(currentInitialValue);
                                return;
                            }
                        }

                        setValue(valueToSet as T);
                    } else {
                        // Data undefined but doc exists? fallback to initial
                        setValue(currentInitialValue);
                    }
                } else {
                    // Document doesn't exist yet, stick with defaults but don't error out
                    // This allows "Initialization" to happen later
                    setValue(currentInitialValue);
                }
            },
            (error) => {
                console.error(`Firestore sync error for ${collectionKey}:`, error);
                // NOTIFY USER OF CONNECTION ERRORS
                if (error.code === 'permission-denied') {
                    // Silent fail for permissions usually, but good to know in dev
                    console.warn("Permission denied for", collectionKey);
                } else {
                    // Show toast for other connectivity issues
                    Swal.fire({
                        icon: 'warning',
                        title: 'การเชื่อมต่อฐานข้อมูลขัดข้อง',
                        text: `ไม่สามารถดึงข้อมูลล่าสุดได้ (${collectionKey})`,
                        toast: true,
                        position: 'bottom-end',
                        showConfirmButton: false,
                        timer: 5000
                    });
                }
            }
        );

        return () => unsubscribe();
    }, [branchId, collectionKey]);

    const setAndSyncValue = useCallback((newValue: React.SetStateAction<T>) => {
        if (!db) {
            Swal.fire('เชื่อมต่อไม่ได้', 'ไม่พบการตั้งค่าฐานข้อมูล (Firebase)', 'error');
            return;
        }

        const globalKeys = [
            'users', 
            'branches', 
            'leaveRequests', 
            'appLogoUrl', 
            'logoUrl', 
            'restaurantName', 
            'restaurantAddress', 
            'restaurantPhone', 
            'taxId',
            'qrCodeUrl',
            'signatureUrl',
            'notificationSoundUrl',
            'staffCallSoundUrl'
        ];

        const isBranchSpecific = !globalKeys.includes(collectionKey);
        
        if (isBranchSpecific && !branchId) {
             console.warn(`Attempted to save ${collectionKey} without a valid Branch ID. Data will be local only.`);
             setValue(newValue);
             return;
        }

        const pathSegments = isBranchSpecific && branchId
            ? ['branches', branchId, collectionKey, 'data']
            : [collectionKey, 'data'];
        
        const docRef = db.doc(pathSegments.join('/'));

        setValue((prevValue) => {
            const resolvedValue = newValue instanceof Function ? newValue(prevValue) : newValue;
            
            // --- NEW: Size Check Logic ---
            try {
                const jsonString = JSON.stringify({ value: resolvedValue });
                const sizeInBytes = new Blob([jsonString]).size;
                const sizeInMB = sizeInBytes / (1024 * 1024);

                // Firestore Limit is 1MB. We warn at 0.9MB.
                if (sizeInMB > 0.9) {
                    Swal.fire({
                        icon: 'error',
                        title: 'ข้อมูลขนาดใหญ่เกินไป!',
                        html: `
                            <div class="text-left">
                                <p>ข้อมูล <b>${collectionKey}</b> มีขนาด <b>${sizeInMB.toFixed(2)} MB</b></p>
                                <p class="text-red-600 font-bold mt-2">เกินขีดจำกัดของฐานข้อมูล (สูงสุด 1 MB)</p>
                                <p class="text-sm mt-2 text-gray-600">คำแนะนำ:</p>
                                <ul class="list-disc list-inside text-sm text-gray-600">
                                    <li>ลดขนาดรูปภาพ (ใช้ลิงก์แทน Base64)</li>
                                    <li>ลบรายการที่ไม่จำเป็นออก</li>
                                </ul>
                            </div>
                        `,
                        confirmButtonText: 'เข้าใจแล้ว (จะไม่ถูกบันทึก)'
                    });
                    // Still update local state so UI doesn't revert immediately, but DB write will likely fail
                }
            } catch (e) {
                console.error("Error checking data size", e);
            }
            // -----------------------------

            docRef.set({ value: resolvedValue })
                .catch(err => {
                    console.error(`Failed to write ${collectionKey} to Firestore:`, err);
                    
                    let errorMessage = err.message;
                    if (err.code === 'resource-exhausted') {
                        errorMessage = 'โควต้าเต็ม หรือ ขนาดไฟล์ใหญ่เกิน 1MB';
                    }

                    // ALERT USER ON WRITE ERROR - This is critical
                    Swal.fire({
                        icon: 'error',
                        title: 'บันทึกข้อมูลไม่สำเร็จ!',
                        html: `
                            <p>ข้อมูลที่คุณแก้ <b>จะไม่ถูกบันทึกลงระบบจริง</b></p>
                            <p class="text-sm mt-2 text-gray-500">สาเหตุที่เป็นไปได้:</p>
                            <ul class="text-sm text-left list-disc list-inside text-gray-500 mb-2">
                                <li>ข้อมูลขนาดใหญ่เกินไป (รูปภาพเยอะ)</li>
                                <li>อินเทอร์เน็ตหลุด</li>
                                <li>โควต้า Firebase เต็ม</li>
                            </ul>
                            <p class="text-xs text-red-500">${errorMessage}</p>
                        `,
                        confirmButtonText: 'รับทราบ'
                    });
                });
                
            return resolvedValue;
        });
    }, [branchId, collectionKey]);

    return [value, setAndSyncValue];
}

// Hook for Collection-based Sync (Robust, Granular Updates)
export function useFirestoreCollection<T extends { id: number | string }>(
    branchId: string | null,
    collectionName: string
): [
    T[], 
    { 
        add: (item: T) => Promise<void>, 
        update: (id: number | string, data: Partial<T>) => Promise<void>, 
        remove: (id: number | string) => Promise<void> 
    }
] {
    const [data, setData] = useState<T[]>([]);

    useEffect(() => {
        if (!db || !branchId) return;

        const collectionRef = db.collection(`branches/${branchId}/${collectionName}`);

        const unsubscribe = collectionRef.onSnapshot(snapshot => {
            const items: T[] = [];
            snapshot.forEach(doc => {
                items.push(doc.data() as T);
            });
            setData(items);
        }, error => {
            console.error(`Error syncing collection ${collectionName}:`, error);
            Swal.fire({
                icon: 'warning',
                title: 'Sync Error',
                text: `ไม่สามารถซิงค์ข้อมูล ${collectionName}`,
                toast: true,
                position: 'bottom-end',
                showConfirmButton: false,
                timer: 4000
            });
        });

        return () => unsubscribe();
    }, [branchId, collectionName]);

    const actions = {
        add: async (item: T) => {
            if (!db || !branchId) return;
            const docId = item.id.toString();
            try {
                await db.collection(`branches/${branchId}/${collectionName}`).doc(docId).set({
                    ...item,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp() // Timestamp Guard
                });
            } catch (err: any) {
                console.error(`Failed to add to ${collectionName}:`, err);
                Swal.fire('บันทึกไม่สำเร็จ', 'ตรวจสอบการเชื่อมต่อหรือขนาดข้อมูล', 'error');
            }
        },
        update: async (id: number | string, updates: Partial<T>) => {
            if (!db || !branchId) return;
            try {
                await db.collection(`branches/${branchId}/${collectionName}`).doc(id.toString()).update({
                    ...updates,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (err: any) {
                console.error(`Failed to update ${collectionName}:`, err);
                Swal.fire('แก้ไขไม่สำเร็จ', 'ตรวจสอบการเชื่อมต่อหรือขนาดข้อมูล', 'error');
            }
        },
        remove: async (id: number | string) => {
            if (!db || !branchId) return;
            try {
                await db.collection(`branches/${branchId}/${collectionName}`).doc(id.toString()).delete();
            } catch (err: any) {
                console.error(`Failed to delete from ${collectionName}:`, err);
                Swal.fire('ลบไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
            }
        }
    };

    return [data, actions];
}
