import React from 'react';

type Props = {
    name?: string;
    size?: number;
    filled?: boolean;
    wght?: number;
    grad?: number;
    className?: string;
};

const MI: React.FC<Props> = ({
    name = 'chevron_right',
    size = 24,
    filled = false,
    wght = 400,
    grad = 0,
    className,
}) => {
    const style = {
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${wght}, 'GRAD' ${grad}, 'opsz' ${size}`,
    } as React.CSSProperties;

    return (
        <span className={`material-symbols-outlined ${className ?? ''}`} style={style}>
            {name}
        </span>
    );
};

export default MI;
