import React, { useState, useEffect } from "react";
import SharedSidebar from "../components/SharedSidebar";
import SharedHeader from "../components/SharedHeader";
import '../styles/Settings.css';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("accounts");
  const [isEditing, setIsEditing] = useState(false); 

const [profile, setProfile] = useState({
  name: "",
  email: "",
  password: "***************",
  profileImage: "https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg", // default
});
const [originalProfile, setOriginalProfile] = useState(profile);

useEffect(() => {
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    const parsedUser = JSON.parse(storedUser);
    setProfile({
      name: parsedUser.name || "",
      email: parsedUser.email || "",
      password: "***************",
      profileImage:
        parsedUser.profileImage ||
        "https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg", // default if none in DB
    });
    setOriginalProfile({
      name: parsedUser.name || "",
      email: parsedUser.email || "",
      password: "***************",
      profileImage:
        parsedUser.profileImage ||
        "https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg",
    });
  }
}, []);

  // --- General settings ---
  const [generalSettings, setGeneralSettings] = useState({
    language: "English",
    darkMode: false,
    volume: 100,
    brightness: 50,
  });

  // Handle profile input changes
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // Save and cancel profile
  const handleSave = () => {
    setOriginalProfile(profile);
    setIsEditing(false);
    localStorage.setItem("user", JSON.stringify(profile)); // optional save
  };

  const handleCancel = () => {
    setProfile(originalProfile);
    setIsEditing(false);
  };

  const handleGeneralChange = (field, value) => {
    setGeneralSettings((prev) => ({ ...prev, [field]: value }));
  };
  return (
    <div className="settings-container">
      {/* Sidebar */}
      <SharedSidebar />

      {/* Main Content */}
      <div className="settings-main">
        <SharedHeader />

        <div className="settings-body">
          {/* Tabs */}
          <h2 className="settings-tabs">
            <span
              className={`settings-tab ${
                activeTab === "general" ? "active" : ""
              }`}
              onClick={() => setActiveTab("general")}
            >
              General
            </span>{" "}
            /{" "}
            <span
              className={`settings-tab ${
                activeTab === "accounts" ? "active" : ""
              }`}
              onClick={() => setActiveTab("accounts")}
            >
              Accounts
            </span>
          </h2>

          {/* General Settings */}
          {activeTab === "general" && (
            <div className="general-container">
              <h3>General</h3>

              {/* Language */}
              <div className="general-field">
                <label>Language</label>
                <select
                  className="general-select"
                  value={generalSettings.language}
                  onChange={(e) =>
                    handleGeneralChange("language", e.target.value)
                  }
                >
                  <option>English</option>
                  <option>Chinese</option>
                </select>
              </div>

              {/* Dark Mode */}
              <div className="general-field">
                <label>Display</label>
                <label className="general-toggle">
                  <span>Dark Mode</span>
                  <input
                    type="checkbox"
                    className="general-checkbox"
                    checked={generalSettings.darkMode}
                    onChange={(e) =>
                      handleGeneralChange("darkMode", e.target.checked)
                    }
                  />
                </label>
              </div>

              {/* Volume */}
              <div className="general-field">
                <label>Volume ({generalSettings.volume}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={generalSettings.volume}
                  onChange={(e) =>
                    handleGeneralChange("volume", parseInt(e.target.value))
                  }
                  className="general-range"
                />
              </div>

              {/* Brightness */}
              <div className="general-field">
                <label>Brightness ({generalSettings.brightness}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={generalSettings.brightness}
                  onChange={(e) =>
                    handleGeneralChange("brightness", parseInt(e.target.value))
                  }
                  className="general-range"
                />
              </div>
            </div>
          )}

          {/* Account Settings */}
          {activeTab === "accounts" && (
            <div className="account-container">
              {/* Profile Picture */}
              <div className="profile-picture">
                <img
                  src={profile.profileImage}
                  alt="Profile"
                  className="profile-icon"
                />
                <p className="upload-logo">Upload Logo</p>
              </div>


              {/* Form Fields */}
              <div>
                {/* Name */}
                <div className="account-field">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    value={profile.name}
                    onChange={handleProfileChange}
                    disabled={!isEditing}
                    className={`account-input ${
                      !isEditing ? "disabled" : ""
                    }`}
                  />
                </div>

                {/* Email */}
                <div className="account-field">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profile.email}
                    onChange={handleProfileChange}
                    disabled={!isEditing}
                    className={`account-input ${
                      !isEditing ? "disabled" : ""
                    }`}
                  />
                </div>

          

                {/* Password */}
                <div className="account-field">
                  <label>Password</label>
                  <div className="password-row">
                    <input
                      type="password"
                      name="password"
                      value={profile.password}
                      disabled
                      className="account-input disabled"
                    />
                    <span className="change-password">Change Password</span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="account-buttons">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn btn-edit"
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button onClick={handleSave} className="btn btn-save">
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="btn btn-cancel"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
