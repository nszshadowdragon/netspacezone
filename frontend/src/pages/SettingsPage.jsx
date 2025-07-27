// src/pages/SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from '../api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ThemeSelector from '../components/themeSelector';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  // Set default auth header
  useEffect(() => {
    const token = localStorage.getItem('nsz_token');
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  const [activeTab, setActiveTab] = useState('basic');
  const [editing, setEditing] = useState({
    basic: false,
    security: false,
    profile: false,
  });

  const [basic, setBasic] = useState({
    email: '', username: '', firstName: '', lastName: '', birthday: '',
  });
  const [security, setSecurity] = useState({
    phone: '', securityQuestion: '', customQuestion: '', securityAnswer: '',
    backupEmail: '', enable2FA: false, pin: '', loginAlerts: false,
    lockdownPhrase: '', recoveryPhrase: '',
  });
  const [profile, setProfile] = useState({
    profilePic: '', bannerPic: '',
    quote: '', location: '',
    languages: '', timezone: '', locale: '', customURL: '',
    twitter: '', instagram: '', linkedin: '', youtube: '',
    discord: '', website: '', facebook: '', tiktok: '',
    github: '', twitch: '', tags: '',
  });

  useEffect(() => {
    if (!user) return;
    setBasic({
      email:     user.email || '',
      username:  user.username || '',
      firstName: user.firstName || '',
      lastName:  user.lastName || '',
      birthday:  user.birthday?.slice(0,10) || '',
    });
    setSecurity({
      phone:            user.phone || '',
      securityQuestion: user.securityQuestion || '',
      customQuestion:   user.customQuestion || '',
      securityAnswer:   user.securityAnswer || '',
      backupEmail:      user.backupEmail || '',
      enable2FA:        !!user.enable2FA,
      pin:              user.pin || '',
      loginAlerts:      !!user.loginAlerts,
      lockdownPhrase:   user.lockdownPhrase || '',
      recoveryPhrase:   user.recoveryPhrase || '',
    });
    setProfile({
      profilePic:   user.profilePic || '',
      bannerPic:    user.bannerPic || '',
      quote:        user.quote || '',
      location:     user.location || '',
      languages:    (user.languages || []).join(', '),
      timezone:     user.timezone || '',
      locale:       user.locale || '',
      customURL:    user.customURL || '',
      twitter:      user.socials?.twitter || '',
      instagram:    user.socials?.instagram || '',
      linkedin:     user.socials?.linkedin || '',
      youtube:      user.socials?.youtube || '',
      discord:      user.socials?.discord || '',
      website:      user.socials?.website || '',
      facebook:     user.socials?.facebook || '',
      tiktok:       user.socials?.tiktok || '',
      github:       user.socials?.github || '',
      twitch:       user.socials?.twitch || '',
      tags:         (user.tags || []).join(', '),
    });
  }, [user]);

  const handleFileUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setProfile(p => ({ ...p, [field]: url }));
  };

  async function save(section) {
    let payload;
    if (section === 'basic') payload = basic;
    else if (section === 'security') payload = security;
    else {
      payload = {
        ...profile,
        tags: profile.tags.split(',').map(s => s.trim()),
        languages: profile.languages.split(',').map(s => s.trim()),
        socials: {
          twitter: profile.twitter,
          instagram: profile.instagram,
          linkedin: profile.linkedin,
          youtube: profile.youtube,
          discord: profile.discord,
          website: profile.website,
          facebook: profile.facebook,
          tiktok: profile.tiktok,
          github: profile.github,
          twitch: profile.twitch,
        },
      };
    }

    try {
      const res = await axios.put('/me', payload);
      updateUser(res.data);
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} saved`);
      setEditing(e => ({ ...e, [section]: false }));
    } catch {
      toast.error('Save failed');
    }
  }

  // ─── SUSPEND ─────────────────────────────────────────────────────────
  const handleSuspend = async () => {
    if (!window.confirm("Suspend your account? You can reactivate later.")) return;
    try {
      await axios.post('/api/me/deactivate');
      logout();
      navigate('/', { replace: true });
      toast.success("Account suspended");
    } catch {
      toast.error("Failed to suspend account");
    }
  };

  // ─── DELETE ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm("Permanently delete your account? This cannot be undone.")) return;
    try {
      await axios.delete('/me');
      logout();
      navigate('/', { replace: true });
      toast.success("Account deleted");
    } catch {
      toast.error("Failed to delete account");
    }
  };
  // ──────────────────────────────────────────────────────────────────────

  const fieldRow = (label, value, onChange, type = 'text', copyable = false) => (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-teal-600 py-2">
      <span className="font-medium text-white mb-1 md:mb-0">{label}</span>
      {onChange ? (
        type === 'checkbox' ? (
          <input
            type="checkbox"
            checked={value}
            onChange={onChange}
            className="h-5 w-5 text-teal-600"
          />
        ) : (
          <input
            type={type}
            className="bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400 w-full md:w-2/3"
            value={value}
            onChange={onChange}
          />
        )
      ) : (
        <div className="flex items-center w-full md:w-2/3">
          <span className="text-white flex-1">{value || '—'}</span>
          {copyable && value && (
            <button
              onClick={() => navigator.clipboard.writeText(value)}
              className="ml-2 px-2 py-1 bg-white text-teal-500 rounded hover:bg-teal-50"
            >
              Copy
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="fixed top-[70px] right-4 z-50">
        <ThemeSelector />
      </div>

      <main className="mt-[70px] flex-grow px-4 py-6 max-w-4xl mx-auto">
        {/* Tabs */}
        <div className="flex justify-center space-x-2 mb-6">
          {['basic','security','profile'].map(key => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2 rounded-lg transition ${
                activeTab===key
                  ? 'bg-teal-500 text-white shadow-lg'
                  : 'border border-teal-500 text-teal-500 hover:bg-teal-50'
              }`}
            >
              {key==='basic' ? 'Basic Info' : key==='security' ? 'Security' : 'Profile Build'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-teal-500 text-white p-6 rounded-lg shadow-inner overflow-auto max-h-[70vh] space-y-6">
          {activeTab==='basic' && (
            <div className="space-y-4">
              {fieldRow('Email', basic.email, editing.basic ? e => setBasic(b => ({...b,email:e.target.value})) : null)}
              {fieldRow('Username', basic.username, editing.basic ? e => setBasic(b => ({...b,username:e.target.value})) : null)}
              {fieldRow('First Name', basic.firstName, editing.basic ? e => setBasic(b => ({...b,firstName:e.target.value})) : null)}
              {fieldRow('Last Name', basic.lastName, editing.basic ? e => setBasic(b => ({...b,lastName:e.target.value})) : null)}
              {fieldRow('Birthday', basic.birthday, null, 'date')}
            </div>
          )}

          {activeTab==='security' && (
            <div className="space-y-4">
              {fieldRow('Phone', security.phone, editing.security ? e => setSecurity(s => ({...s,phone:e.target.value})) : null)}
              {fieldRow('Security Question', security.securityQuestion, editing.security ? e => setSecurity(s=>({...s,securityQuestion:e.target.value})) : null)}
              {fieldRow('Custom Question', security.customQuestion, editing.security ? e => setSecurity(s=>({...s,customQuestion:e.target.value})) : null)}
              {fieldRow('Answer', security.securityAnswer, editing.security ? e => setSecurity(s=>({...s,securityAnswer:e.target.value})) : null)}
              {fieldRow('Backup Email', security.backupEmail, editing.security ? e => setSecurity(s=>({...s,backupEmail:e.target.value})) : null)}
              {fieldRow('Enable 2FA', security.enable2FA, editing.security ? e => setSecurity(s=>({...s,enable2FA:e.target.checked})) : null,'checkbox')}
              {fieldRow('Login Alerts', security.loginAlerts, editing.security ? e => setSecurity(s=>({...s,loginAlerts:e.target.checked})) : null,'checkbox')}
            </div>
          )}

          {activeTab==='profile' && (
            <div className="space-y-6">
              {/* Avatar & Cover */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-2">
                  <div className="font-medium text-white">Profile Picture</div>
                  {profile.profilePic
                    ? <img src={profile.profilePic} alt="Avatar" className="w-24 h-24 rounded-full border-2 border-white object-cover"/>
                    : <div className="w-24 h-24 bg-gray-200 rounded-full" />}
                  <input type="file" accept="image/*" onChange={e=>handleFileUpload(e,'profilePic')} className="text-sm text-white"/>
                </div>
                <div className="flex flex-col space-y-2">
                  <div className="font-medium text-white">Cover</div>
                  {profile.bannerPic
                    ? <img src={profile.bannerPic} alt="Cover" className="w-full h-28 rounded-lg border-2 border-white object-cover"/>
                    : <div className="w-full h-28 bg-gray-200 rounded-lg" />}
                  <input type="file" accept="image/*" onChange={e=>handleFileUpload(e,'bannerPic')} className="text-sm text-white"/>
                </div>
              </div>

              {/* Quote & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fieldRow('Favorite Quote', profile.quote, editing.profile ? e => setProfile(p=>({...p,quote:e.target.value})) : null)}
                {fieldRow('Location', profile.location, editing.profile ? e => setProfile(p=>({...p,location:e.target.value})) : null)}
              </div>

              {/* Social Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['twitter','instagram','linkedin','youtube','discord','website','facebook','tiktok','github','twitch'].map(svc =>
                  fieldRow(
                    svc.charAt(0).toUpperCase()+svc.slice(1),
                    profile[svc],
                    editing.profile ? e => setProfile(p=>({...p,[svc]:e.target.value})) : null,
                    'text',
                    true
                  )
                )}
              </div>

              {/* Misc */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fieldRow('Timezone', profile.timezone, editing.profile ? e => setProfile(p=>({...p,timezone:e.target.value})) : null)}
                {fieldRow('Locale', profile.locale, editing.profile ? e => setProfile(p=>({...p,locale:e.target.value})) : null)}
                {fieldRow('Custom URL', profile.customURL, editing.profile ? e => setProfile(p=>({...p,customURL:e.target.value})) : null)}
              </div>

              {/* Tags */}
              <div>
                <label className="font-medium text-white block mb-1">Tags</label>
                <textarea
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  rows={4}
                  value={profile.tags}
                  onChange={e=>setProfile(p=>({...p,tags:e.target.value}))}
                  placeholder="Enter comma-separated tags"
                />
              </div>
            </div>
          )}
        </div>

        {/* Edit / Save */}
        <div className="flex justify-center mt-2 space-x-4">
          {editing[activeTab] ? (
            <>
              <button onClick={()=>setEditing(e=>({...e,[activeTab]:false}))}
                className="px-5 py-2 bg-white text-teal-500 rounded hover:bg-teal-50">
                Cancel
              </button>
              <button onClick={()=>save(activeTab)}
                className="px-5 py-2 bg-white text-teal-500 rounded hover:bg-teal-50">
                Save
              </button>
            </>
          ) : (
            <button onClick={()=>setEditing(e=>({...e,[activeTab]:true}))}
              className="px-5 py-2 bg-white text-teal-500 rounded hover:bg-teal-50">
              Edit
            </button>
          )}
        </div>

        {/* Suspend / Delete */}
        <div className="flex justify-center space-x-4 mt-6">
          <button onClick={handleSuspend}
            className="px-5 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
            Suspend Account
          </button>
          <button onClick={handleDelete}
            className="px-5 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            Delete Account
          </button>
        </div>
      </main>
    </div>
  );
}
