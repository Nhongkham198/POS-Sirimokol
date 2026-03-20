
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '@/firebaseConfig';
import type { Table } from '@/types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import Swal from 'sweetalert2';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the whole app, but we log it clearly
}

// Hook for Single Document Sync (Legacy/Config/Arrays)
// Returns: [value, setValue, isSynced]
export function useFirestoreSync<T>(
    branchId: string | null,
    collectionKey: string,
    initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
    const [value, setValue] = useState<T>(initialValue);
    const [isSynced, setIsSynced] = useState(false); 
    
    // SAFETY LOCK: ป้องกันการเขียนข้อมูลทับ ถ้ายังไม่ได้อ่านข้อมูลครั้งแรก
    const isReadyToWrite = useRef(false);
    
    const initialValueRef = useRef(initialValue);
    
    // Keep a ref to the current value to avoid stale closures
    const valueRef = useRef(value);
    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    const getCacheKey = useCallback(() => {
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
        return `fs_cache_${collectionKey}${isBranchSpecific && branchId ? `_${branchId}` : ''}`;
    }, [branchId, collectionKey]);

    useEffect(() => {
        if (!db) {
            console.error("Firestore is not initialized.");
            return () => {};
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
        const currentInitialValue = initialValueRef.current;

        // Reset sync status when branch changes
        setIsSynced(false);
        isReadyToWrite.current = false;

        // --- LOCAL CACHE RECOVERY ---
        const cacheKey = getCacheKey();
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                setValue(parsed);
                // We don't set isSynced to true yet because we still want to wait for Firestore
            } catch (e) {
                console.error(`Failed to parse cache for ${collectionKey}`, e);
            }
        }
        // ----------------------------

        if (isBranchSpecific && !branchId) {
            // If no branch selected, try to use cache or initial value
            if (!cachedData) {
                setValue(currentInitialValue);
            }
            setIsSynced(true); 
            isReadyToWrite.current = true; 
            return () => {};
        }

        const pathSegments = isBranchSpecific && branchId
            ? ['branches', branchId, collectionKey, 'data']
            : [collectionKey, 'data'];
        
        const docRef = db.doc(pathSegments.join('/'));

        const unsubscribe = docRef.onSnapshot(
            { includeMetadataChanges: true }, 
            (docSnapshot) => {
                // *** CRITICAL: Mark as ready to write ONLY after we receive the first snapshot ***
                isReadyToWrite.current = true;

                if (docSnapshot.exists) {
                    const data = docSnapshot.data();
                    
                    if (data && typeof data.value !== 'undefined') {
                        // STANDARD FORMAT: { value: [...] }
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
                                // Invalid data structure, don't set
                            } else {
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
                                }
                            }
                        }

                        setValue(valueToSet as T);
                        // Update Cache
                        localStorage.setItem(cacheKey, JSON.stringify(valueToSet));
                    } else if (data && Array.isArray(currentInitialValue)) {
                        // NON-STANDARD FORMAT (Flattened Object): { "0": {...}, "1": {...} }
                        console.warn(`[FirestoreSync] Detected flattened array structure for ${collectionKey}. converting to array.`);
                        const items = Object.values(data);
                        setValue(items as any as T);
                        localStorage.setItem(cacheKey, JSON.stringify(items));
                    } else {
                        // Doc exists but empty value - use cache if available, otherwise initial
                        if (!cachedData) {
                            setValue(currentInitialValue);
                        }
                    }
                } else {
                    // Doc doesn't exist yet - use cache if available, otherwise initial
                    if (!cachedData) {
                        setValue(currentInitialValue);
                    }
                }
                setIsSynced(true); 
            },
            (error) => {
                handleFirestoreError(error, OperationType.GET, pathSegments.join('/'));
                // On error, keep using whatever we have (cache or initial)
                setIsSynced(true);
            }
        );

        return () => unsubscribe();
    }, [branchId, collectionKey, getCacheKey]);

    const setAndSyncValue = useCallback((newValue: React.SetStateAction<T>) => {
        // *** SAFETY LOCK CHECK ***
        if (!isReadyToWrite.current) {
            console.warn(`[Safety Lock] Blocked write to ${collectionKey} because initial data hasn't loaded yet.`);
            return; 
        }

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
        const cacheKey = getCacheKey();

        setValue((prevValue) => {
            const resolvedValue = newValue instanceof Function ? newValue(prevValue) : newValue;
            
            // --- DATA LOSS PROTECTION ---
            // If we are about to save an empty array but we currently have many items, 
            // and it's a critical collection like menuItems or tables, we should be careful.
            const criticalKeys = ['menuItems', 'tables', 'categories', 'branches', 'users'];
            if (
                criticalKeys.includes(collectionKey) && 
                Array.isArray(prevValue) && prevValue.length > 5 && 
                Array.isArray(resolvedValue) && resolvedValue.length === 0
            ) {
                console.error(`[Data Loss Protection] Blocked attempt to clear ${collectionKey} with ${prevValue.length} items.`);
                Swal.fire({
                    icon: 'warning',
                    title: 'ตรวจพบความผิดปกติ!',
                    text: `ระบบตรวจพบความพยายามลบข้อมูล ${collectionKey} ทั้งหมด (${prevValue.length} รายการ) หากคุณไม่ได้ตั้งใจลบ ข้อมูลจะไม่ถูกบันทึกเพื่อความปลอดภัย`,
                    confirmButtonText: 'รับทราบ (ยกเลิกการลบ)',
                    showCancelButton: true,
                    cancelButtonText: 'ยืนยันการลบทั้งหมดจริงๆ'
                }).then((result) => {
                    if (result.isDismissed) {
                        // User explicitly confirmed deletion via cancel button
                        docRef.set({ value: [] }).catch(err => console.error(err));
                        localStorage.setItem(cacheKey, JSON.stringify([]));
                    }
                });
                return prevValue; // Revert to previous value locally
            }
            // ----------------------------

            // Update Cache immediately for better responsiveness
            localStorage.setItem(cacheKey, JSON.stringify(resolvedValue));

            // --- Size Check Logic ---
            try {
                const jsonString = JSON.stringify({ value: resolvedValue });
                const sizeInBytes = new Blob([jsonString]).size;
                const sizeInMB = sizeInBytes / (1024 * 1024);

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
                    // Still update local state so UI doesn't revert immediately, but prevent DB write
                    return resolvedValue;
                }
            } catch (e) {
                console.error("Error checking data size", e);
            }
            // -----------------------------

            // Always write in the standard format { value: ... }
            // This effectively migrates any "flattened" legacy data to the correct format on next save.
            docRef.set({ value: resolvedValue })
                .catch(err => {
                    handleFirestoreError(err, OperationType.WRITE, pathSegments.join('/'));
                    let errorMessage = err.message;
                    if (err.code === 'resource-exhausted') {
                        errorMessage = 'โควต้าเต็ม หรือ ขนาดไฟล์ใหญ่เกิน 1MB';
                    }
                    Swal.fire({
                        icon: 'error',
                        title: 'บันทึกข้อมูลไม่สำเร็จ!',
                        html: `<p class="text-xs text-red-500 mt-2">${errorMessage}</p>`,
                        confirmButtonText: 'รับทราบ'
                    });
                });
                
            return resolvedValue;
        });
    }, [branchId, collectionKey]);

    return [value, setAndSyncValue, isSynced];
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
        if (!db || !branchId) {
            console.log(`[Debug] useFirestoreCollection: Missing db or branchId`, { branchId, collectionName });
            return;
        }

        const path = `branches/${branchId}/${collectionName}`;
        console.log(`[Debug] useFirestoreCollection: Listening to path: ${path}`);
        const collectionRef = db.collection(path);

        const unsubscribe = collectionRef.onSnapshot(snapshot => {
            const items: T[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Ensure id is always present, prioritizing doc.id if missing in data
                // Convert to number if it's a numeric string to match ActiveOrder interface
                const id = isNaN(Number(doc.id)) ? doc.id : Number(doc.id);
                items.push({ 
                    ...data,
                    id: id
                } as T);
            });
            console.log(`[Debug] useFirestoreCollection: Received ${items.length} items from ${path}`);
            setData(items);
        }, error => {
            handleFirestoreError(error, OperationType.LIST, path);
        });

        return () => unsubscribe();
    }, [branchId, collectionName]);

    const actions = {
        add: async (item: T) => {
            if (!db || !branchId) return;
            const docId = item.id.toString();
            const fullPath = `branches/${branchId}/${collectionName}/${docId}`;
            console.log(`[Debug] useFirestoreCollection: Adding item to ${fullPath}`, item);
            try {
                await db.collection(`branches/${branchId}/${collectionName}`).doc(docId).set({
                    ...item,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (err: any) {
                handleFirestoreError(err, OperationType.WRITE, `branches/${branchId}/${collectionName}/${docId}`);
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
                handleFirestoreError(err, OperationType.UPDATE, `branches/${branchId}/${collectionName}/${id}`);
                Swal.fire('แก้ไขไม่สำเร็จ', 'ตรวจสอบการเชื่อมต่อหรือขนาดข้อมูล', 'error');
            }
        },
        remove: async (id: number | string) => {
            if (!db || !branchId) return;
            try {
                await db.collection(`branches/${branchId}/${collectionName}`).doc(id.toString()).delete();
            } catch (err: any) {
                handleFirestoreError(err, OperationType.DELETE, `branches/${branchId}/${collectionName}/${id}`);
                Swal.fire('ลบไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
            }
        }
    };

    return [data, actions];
}
