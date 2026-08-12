// src/components/Header.jsx
import React from 'react';
import './Header.css';

const Header = () => {
  const currentMonthYear = new Date().toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="header-wrapper">
      <div className="header-title-line-group">
      <h1 className="header-title">{currentMonthYear}</h1>
      </div>
    </div>
  );
};

export default Header;
