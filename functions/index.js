
// functions/index.js (To be deployed to Firebase Cloud Functions)

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Only initialize once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * This Cloud Function triggers when a NEW document is created in the 'activeOrders' collection.
 * UPDATED: Listens to the specific document path for the new collection-based architecture.
 */
exports.sendHighPriorityOrderNotification = functions.region('asia-southeast1').firestore
    .document('branches/{branchId}/activeOrders/{orderId}')
    .onCreate(async (snap, context) => {
        // Get the newly created order data directly
        const newOrder = snap.data();

        if (!newOrder) {
            console.log('No order data found.');
            return null;
        }

        console.log(`New order detected: #${newOrder.orderNumber} for Table ${newOrder.tableName} in branch ${context.params.branchId}`);

        // Get all users from the 'users/data' document to find tokens.
        const usersDoc = await admin.firestore().collection('users').doc('data').get();
        if (!usersDoc.exists) {
            console.error('Users document not found!');
            return null;
        }
        const allUsers = usersDoc.data().value || [];

        // Filter for kitchen staff, collect all their tokens from the `fcmTokens` array.
        const branchIdNumber = parseInt(context.params.branchId, 10);
        const targetRoles = ['kitchen']; // Send only to Kitchen
        const allStaffTokens = allUsers
            .filter(user => 
                targetRoles.includes(user.role) && 
                user.fcmTokens && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0 &&
                user.allowedBranchIds &&
                user.allowedBranchIds.includes(branchIdNumber)
            )
            .flatMap(user => user.fcmTokens); 

        // Remove duplicate tokens
        const staffTokens = [...new Set(allStaffTokens)];

        if (staffTokens.length === 0) {
            console.log('No Kitchen staff with registered devices found for this branch.');
            return null;
        }
        
        console.log(`Found ${staffTokens.length} Kitchen staff tokens to notify.`);

        // Construct the high-priority message payload.
        const notificationTitle = '🔔 มีออเดอร์ใหม่!';
        const notificationBody = `โต๊ะ ${newOrder.tableName} (ออเดอร์ #${String(newOrder.orderNumber).padStart(3, '0')})`;

        const message = {
            notification: {
                title: notificationTitle,
                body: notificationBody,
            },
            data: {
                title: notificationTitle,
                body: notificationBody,
                icon: '/icon.svg',
                // Ensure this sound URL is valid and accessible
                // Updated to use the correct storage bucket for pos-sirimonkol
                sound: 'https://firebasestorage.googleapis.com/v0/b/pos-sirimonkol.firebasestorage.app/o/sounds%2Fdefault-notification.mp3?alt=media',
                vibrate: '[200, 100, 200]',
                url: '/?view=kitchen' // Open kitchen view on click
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'high_importance_channel',
                    sound: 'default'
                }
            },
            tokens: staffTokens
        };

        // Send the message using the FCM Admin SDK.
        try {
            const response = await admin.messaging().sendMulticast(message);
            console.log('Successfully sent message:', response.successCount, 'successes,', response.failureCount, 'failures');
            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(staffTokens[idx]);
                    }
                });
                console.log('List of tokens that caused failures: ' + failedTokens);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
        
        return null;
    });

/**
 * This Cloud Function triggers when the 'staffCalls' document for any branch is updated.
 * It sends a high-priority notification to POS, Admin, Branch-Admin, and Kitchen staff
 * when a customer requests assistance.
 */
exports.sendStaffCallNotification = functions.region('asia-southeast1').firestore
    .document('branches/{branchId}/staffCalls/data')
    .onUpdate(async (change, context) => {
        const callsBefore = change.before.data().value || [];
        const callsAfter = change.after.data().value || [];

        // Check if a new call was added
        if (callsAfter.length <= callsBefore.length) return null;

        const callsBeforeIds = new Set(callsBefore.map(c => c.id));
        const newCall = callsAfter.find(c => !callsBeforeIds.has(c.id));

        if (!newCall) return null;

        const usersDoc = await admin.firestore().collection('users').doc('data').get();
        if (!usersDoc.exists) return null;
        const allUsers = usersDoc.data().value || [];

        const branchIdNumber = parseInt(context.params.branchId, 10);
        // Roles that should receive staff calls
        const targetRoles = ['pos', 'branch-admin', 'admin', 'kitchen'];

        const staffTokens = allUsers
            .filter(user => 
                targetRoles.includes(user.role) &&
                user.fcmTokens && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0 &&
                // Admin gets everything, others must match branch
                (user.role === 'admin' || (user.allowedBranchIds && user.allowedBranchIds.includes(branchIdNumber)))
            )
            .flatMap(user => user.fcmTokens);

        const uniqueTokens = [...new Set(staffTokens)];

        if (uniqueTokens.length === 0) return null;

        const title = '🔔 ลูกค้าเรียกพนักงาน!';
        const body = `โต๊ะ ${newCall.tableName} (คุณ ${newCall.customerName}) ต้องการความช่วยเหลือ`;

        const message = {
            notification: {
                title: title,
                body: body,
            },
            data: {
                title: title,
                body: body,
                icon: '/icon.svg',
                sound: 'default',
                vibrate: '[200, 100, 200]'
            },
            android: { priority: 'high' },
            tokens: uniqueTokens
        };

        try {
            await admin.messaging().sendMulticast(message);
            console.log(`Sent staff call notification to ${uniqueTokens.length} devices.`);
        } catch (error) {
            console.error('Error sending staff call notification:', error);
        }
        return null;
    });

/**
 * Scheduled function to delete old slip images (older than 2 days).
 * NOTE: This function requires the Firebase "Blaze" (Pay-as-you-go) plan because it uses Cloud Scheduler.
 * It runs every day at 3:00 AM.
 * 
 * UPDATE: Also cleans up Base64 strings in Firestore 'completedOrders_v2' documents (New Collection).
 */
exports.cleanupOldData = functions.region('asia-southeast1').pubsub.schedule('0 4 * * *')
  .timeZone('Asia/Bangkok')
  .onRun(async (context) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 2); // 2 days ago
    const cutoffTimestamp = cutoffDate.getTime();

    console.log(`Starting cleanup for data older than ${cutoffDate.toISOString()}`);

    // 1. Cleanup Storage Files (Legacy)
    const bucket = admin.storage().bucket();
    try {
      const [files] = await bucket.getFiles({ prefix: 'slips/' });
      let deletedFiles = 0;
      for (const file of files) {
        const fileDate = new Date(file.metadata.timeCreated);
        if (fileDate < cutoffDate) {
          await file.delete().catch(e => console.error(`Failed to delete file ${file.name}`, e));
          deletedFiles++;
        }
      }
      console.log(`Deleted ${deletedFiles} old storage files.`);
    } catch (error) {
      console.error('Error cleaning storage:', error);
    }

    try {
        const branchesSnapshot = await admin.firestore().collection('branches').get();
        
        for (const branchDoc of branchesSnapshot.docs) {
            const branchId = branchDoc.id;
            
            // 2. Cleanup New Collection 'completedOrders_v2'
            const ordersSnapshot = await admin.firestore().collection(`branches/${branchId}/completedOrders_v2`)
                .where('completionTime', '<', cutoffTimestamp)
                .get();

            let batch = admin.firestore().batch();
            let count = 0;

            for (const doc of ordersSnapshot.docs) {
                const order = doc.data();
                if (order.paymentDetails && order.paymentDetails.slipImage) {
                    const docRef = admin.firestore().doc(`branches/${branchId}/completedOrders_v2/${doc.id}`);
                    batch.update(docRef, { 'paymentDetails.slipImage': null });
                    count++;
                    if (count >= 400) { await batch.commit(); batch = admin.firestore().batch(); count = 0; }
                }
            }
            if (count > 0) { await batch.commit(); }
            console.log(`Cleaned up v2 slips in ${count} orders for branch ${branchId}`);

            // 3. Cleanup Legacy Array 'completedOrders/data'
            const legacyDocRef = admin.firestore().doc(`branches/${branchId}/completedOrders/data`);
            const legacyDoc = await legacyDocRef.get();
            if (legacyDoc.exists) {
                const data = legacyDoc.data();
                if (data && Array.isArray(data.value)) {
                    let hasChanges = false;
                    const updatedOrders = data.value.map(order => {
                        if (order.completionTime < cutoffTimestamp && order.paymentDetails && order.paymentDetails.slipImage) {
                            hasChanges = true;
                            // Return new object with null image
                            return {
                                ...order,
                                paymentDetails: {
                                    ...order.paymentDetails,
                                    slipImage: null
                                }
                            };
                        }
                        return order;
                    });

                    if (hasChanges) {
                        await legacyDocRef.update({ value: updatedOrders });
                        console.log(`Cleaned up Legacy slips for branch ${branchId}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error cleaning Firestore documents:', error);
    }

    return null;
});