
import React, { useMemo } from 'react';
import type { LeaveRequest, User } from '../types';
import PieChart from './PieChart';
import { SalesChart } from './SalesChart';

interface LeaveAnalyticsProps {
    leaveRequests: LeaveRequest[];
    users: User[];
}

export const LeaveAnalytics: React.FC<LeaveAnalyticsProps> = ({ leaveRequests, users }) => {
    // 1. Process Data
    const { topLeavers, typeDistribution, predictions } = useMemo(() => {
        const approvedLeaves = leaveRequests.filter(req => req.status === 'approved');
        
        // --- Per User Stats ---
        // Use username as key to aggregate correctly even if user ID changed (deleted/recreated)
        // This also ensures we find the current profile picture for the name
        const userStats: Record<string, { totalDays: number, count: number, dates: number[], username: string, profilePic?: string }> = {};
        
        approvedLeaves.forEach(req => {
            const userKey = req.username;
            if (!userStats[userKey]) {
                const user = users.find(u => u.username === userKey);
                userStats[userKey] = { 
                    totalDays: 0, 
                    count: 0, 
                    dates: [], 
                    username: req.username,
                    profilePic: user?.profilePictureUrl 
                };
            }
            
            // Calculate duration
            let duration = 0;
            if (req.isHalfDay) {
                duration = 0.5;
            } else {
                // Fix: duration calculation. endDate is set to 23:59:59, so the difference is already the full duration.
                // Math.round handles the close-to-full-day difference (e.g. 0.999 days -> 1 day).
                const days = Math.round((req.endDate - req.startDate) / (1000 * 60 * 60 * 24));
                duration = days > 0 ? days : 1; // Fallback to 1 if calculation is 0 (e.g. legacy data)
            }
            
            userStats[userKey].totalDays += duration;
            userStats[userKey].count += 1;
            userStats[userKey].dates.push(req.startDate);
        });

        // --- Top Leavers (Chart Data) ---
        const sortedUsers = Object.values(userStats).sort((a, b) => b.totalDays - a.totalDays);
        const topLeavers = {
            labels: sortedUsers.map(u => u.username),
            data: sortedUsers.map(u => u.totalDays),
            images: sortedUsers.map(u => u.profilePic || ''),
            maxValue: Math.max(...sortedUsers.map(u => u.totalDays), 10) // Min scale 10
        };

        // --- Type Distribution (Pie Chart) ---
        const typeCounts: Record<string, number> = {};
        approvedLeaves.forEach(req => {
            const typeLabel = getTypeLabel(req.type);
            typeCounts[typeLabel] = (typeCounts[typeLabel] || 0) + 1;
        });
        
        const typeDistribution = {
            labels: Object.keys(typeCounts),
            data: Object.values(typeCounts),
            colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        };

        // --- Predictive Insights ---
        const predictionsList = Object.values(userStats).map(stat => {
            if (stat.dates.length < 2) return null;
            
            // Sort dates
            const sortedDates = stat.dates.sort((a, b) => a - b);
            
            // Calculate intervals
            let totalInterval = 0;
            for (let i = 1; i < sortedDates.length; i++) {
                totalInterval += (sortedDates[i] - sortedDates[i-1]);
            }
            
            const avgIntervalMs = totalInterval / (sortedDates.length - 1);
            const avgIntervalDays = Math.round(avgIntervalMs / (1000 * 60 * 60 * 24));
            
            const lastLeave = sortedDates[sortedDates.length - 1];
            const nextEstimatedDate = new Date(lastLeave + avgIntervalMs);

            return {
                username: stat.username,
                count: stat.count,
                avgInterval: avgIntervalDays,
                nextDate: nextEstimatedDate
            };
        }).filter(Boolean) as { username: string, count: number, avgInterval: number, nextDate: Date }[];

        // Sort by who is likely to leave soonest
        predictionsList.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

        return { topLeavers, typeDistribution, predictions: predictionsList };

    }, [leaveRequests, users]);

    function getTypeLabel(type: string) {
        switch (type) {
            case 'sick': return 'ลาป่วย';
            case 'personal': return 'ลากิจ';
            case 'vacation': return 'ลาพักร้อน';
            case 'leave-without-pay': return 'ลาไม่รับเงินเดือน';
            default: return 'อื่นๆ';
        }
    }

    return (
        <div className="flex flex-col h-full w-full bg-gray-50 overflow-y-auto p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                วิเคราะห์ข้อมูลวันลา (Leave Analytics)
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Bar Chart: Top Leavers */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <SalesChart
                        title="พนักงานที่ลามากที่สุด (จำนวนวันรวม)"
                        data={topLeavers.data}
                        labels={topLeavers.labels}
                        images={topLeavers.images}
                        maxValue={topLeavers.maxValue}
                        formatValue={(val) => val + ' วัน'}
                    />
                </div>

                {/* Pie Chart: Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <PieChart
                        title="สัดส่วนประเภทการลา"
                        data={typeDistribution.data}
                        labels={typeDistribution.labels}
                        colors={typeDistribution.colors}
                    />
                </div>
            </div>

            {/* Predictive Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-purple-50 flex items-center justify-between">
                    <h3 className="font-bold text-purple-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        การคาดการณ์แนวโน้ม (AI Prediction)
                    </h3>
                    <span className="text-xs text-purple-600 bg-white px-2 py-1 rounded-full border border-purple-200">
                        คำนวณจากประวัติการลาในอดีต
                    </span>
                </div>
                
                {predictions.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-gray-500 bg-gray-50 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">พนักงาน</th>
                                    <th className="px-6 py-3 text-center">จำนวนครั้งที่ลา</th>
                                    <th className="px-6 py-3 text-center">ความถี่เฉลี่ย</th>
                                    <th className="px-6 py-3 text-right">คาดว่าจะลาครั้งถัดไป</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {predictions.map((pred, idx) => (
                                    <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{pred.username}</td>
                                        <td className="px-6 py-4 text-center text-gray-600">{pred.count} ครั้ง</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                                                ทุกๆ ~{pred.avgInterval} วัน
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-gray-800">
                                                    {pred.nextDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    ({Math.ceil((pred.nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} วันจากนี้)
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <p>ยังไม่มีข้อมูลเพียงพอสำหรับการคาดการณ์ (ต้องมีการลาอย่างน้อย 2 ครั้ง)</p>
                    </div>
                )}
            </div>
        </div>
    );
};
