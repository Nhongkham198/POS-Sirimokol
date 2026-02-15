
import React from 'react';

interface AdminHeaderProps {
    title: string;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ title }) => {
    return (
        <header className="bg-gray-800 text-white p-4 shadow-md">
            <h1 className="text-xl font-bold">{title}</h1>
        </header>
    );
};

export default AdminHeader;
