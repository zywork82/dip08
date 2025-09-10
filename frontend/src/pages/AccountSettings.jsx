import React, { useState, useRef } from 'react';
import '../styles/Settings.css';

const AccountSettings = () => {
  const [name, setName] = useState('Andy Khong');
  const [email, setEmail] = useState('andykhong@e.ntu.edu.sg');
  const [phoneNumber, setPhoneNumber] = useState('81234567');
  const [profilePicture, setProfilePicture] = useState('https://i.pravatar.cc/150?img=5');
  const [isEditing, setIsEditing] = useState(false);
  const [originalValues, setOriginalValues] = useState({});
  const fileInputRef = useRef(null); // Create a reference to the file input

  const handleEditToggle = () => {
    if (isEditing) {
      setName(originalValues.name);
      setEmail(originalValues.email);
      setPhoneNumber(originalValues.phoneNumber);
    } else {
      setOriginalValues({ name, email, phoneNumber });
    }
    setIsEditing(!isEditing);
  };

  const handleSaveChanges = () => {
    console.log('Saving changes:', { name, email, phoneNumber });
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    console.log('Change password clicked');
  };

  const handleUploadNewPhoto = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleUploadButtonClick = () => {
    // Programmatically click the hidden file input
    fileInputRef.current.click();
  };

  return (
    <div className="account-settings">
      <h2 className="content-title">Account</h2>
      <div className="settings-card">
        <h3 className="card-section-title">User Profile Information</h3>
        <div className="profile-info-grid">
          <div className="profile-inputs">
            <div className="setting-input-group">
              <label className="input-label">Name</label>
              <input 
                type="text" 
                className="setting-input" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                disabled={!isEditing}
              />
            </div>
            <div className="setting-input-group">
              <label className="input-label">Email</label>
              <input 
                type="email" 
                className="setting-input" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled={!isEditing}
              />
            </div>
            <div className="setting-input-group">
              <label className="input-label">Phone Number</label>
              <input 
                type="tel" 
                className="setting-input" 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)} 
                disabled={!isEditing}
              />
            </div>
            <div className="button-group">
              <button className="edit-button" onClick={handleEditToggle}>
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
              {isEditing && (
                <button className="save-button" onClick={handleSaveChanges}>
                  Save Changes
                </button>
              )}
            </div>
          </div>
          <div className="profile-picture-section">
            <p className="profile-picture-label">Profile Picture</p>
            <img src={profilePicture} alt="Profile" className="profile-display-image" />
            <input
              type="file"
              id="upload-photo"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadNewPhoto}
              ref={fileInputRef} // Attach the ref here
            />
            <button 
              className={`upload-photo-button ${!isEditing ? 'disabled' : ''}`}
              onClick={handleUploadButtonClick}
              disabled={!isEditing}
            >
              Upload New Photo
            </button>
          </div>
        </div>
      </div>
      
      <div className="settings-card password-security-card">
        <h3 className="card-section-title">Password Security</h3>
        <button className="change-password-button" onClick={handleChangePassword}>
          Change Password
        </button>
      </div>
    </div>
  );
};

export default AccountSettings;