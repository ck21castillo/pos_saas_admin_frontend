import React from 'react';
import '../styles/PageLayout.css';

export default function PageLayout({
    title,
    right,
    children,
}: {
    title: string;
    right?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="page-layout-container">
            <div className="page-layout-title">
                <h2>{title}</h2>
                <div>{right}</div>
            </div>

            <div className="page-layout-card">{children}</div>
        </div>
    );
}
