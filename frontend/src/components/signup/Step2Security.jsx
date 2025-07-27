import React, { useState, useEffect } from 'react';

const Step2Security = ({ onDataChange }) => {
  const [phone, setPhone]                     = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [customQuestion, setCustomQuestion]   = useState('');
  const [securityAnswer, setSecurityAnswer]   = useState('');
  const [backupEmail, setBackupEmail]         = useState('');
  const [enable2FA, setEnable2FA]             = useState(false);
  const [pin, setPin]                         = useState('');
  const [loginAlerts, setLoginAlerts]         = useState(true);
  const [lockdownPhrase, setLockdownPhrase]   = useState('');
  const [recoveryPhrase, setRecoveryPhrase]   = useState('');

  useEffect(() => {
    if (securityQuestion === 'Custom Question') {
      setCustomQuestion('');
    }
  }, [securityQuestion]);

  // Lift data up on any change
  useEffect(() => {
    onDataChange({
      phone,
      securityQuestion,
      customQuestion,
      securityAnswer,
      backupEmail,
      enable2FA,
      pin,
      loginAlerts,
      lockdownPhrase,
      recoveryPhrase,
    });
  }, [
    phone,
    securityQuestion,
    customQuestion,
    securityAnswer,
    backupEmail,
    enable2FA,
    pin,
    loginAlerts,
    lockdownPhrase,
    recoveryPhrase,
    onDataChange,
  ]);

  const validatePhone = num => /^\+?\d{7,15}$/.test(num);
  const validateEmail = em  => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
  const validatePIN   = p   => /^\d{4,6}$/.test(p);

  return (
    <div className="space-y-6 text-gray-900">
      {/* Phone Number */}
      <div>
        <label className="block text-sm font-medium">Phone Number</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+1234567890"
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
        {phone && !validatePhone(phone) && (
          <p className="text-xs text-red-500 mt-1">Invalid phone format</p>
        )}
      </div>

      {/* Security Question */}
      <div>
        <label className="block text-sm font-medium">Security Question</label>
        <select
          value={securityQuestion}
          onChange={e => setSecurityQuestion(e.target.value)}
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select a question --</option>
          <option>What was your first pet's name?</option>
          <option>What is your mother's maiden name?</option>
          <option>What is your favorite teacher's name?</option>
          <option>Custom Question</option>
        </select>
        {securityQuestion === 'Custom Question' && (
          <input
            type="text"
            value={customQuestion}
            onChange={e => setCustomQuestion(e.target.value)}
            placeholder="Enter custom question"
            className="w-full mt-2 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
        )}
        <input
          type="text"
          value={securityAnswer}
          onChange={e => setSecurityAnswer(e.target.value)}
          placeholder="Your answer"
          className="w-full mt-2 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Backup Email */}
      <div>
        <label className="block text-sm font-medium">Backup Email</label>
        <input
          type="email"
          value={backupEmail}
          onChange={e => setBackupEmail(e.target.value)}
          placeholder="backup@example.com"
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
        {backupEmail && !validateEmail(backupEmail) && (
          <p className="text-xs text-red-500 mt-1">Invalid email format</p>
        )}
      </div>

      {/* Other toggles */}
      <div className="flex items-center">
        <input
          id="loginAlerts"
          type="checkbox"
          checked={loginAlerts}
          onChange={() => setLoginAlerts(v => !v)}
          className="mr-2"
        />
        <label htmlFor="loginAlerts" className="text-sm">
          Enable login alerts for new devices
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium">PIN Code (4–6 digits)</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/, ''))}
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
        {pin && !validatePIN(pin) && (
          <p className="text-xs text-red-500 mt-1">PIN must be 4–6 digits</p>
        )}
      </div>

      {/* Optional phrases */}
      <div>
        <label className="block text-sm font-medium">Account Lockdown Phrase</label>
        <input
          type="text"
          value={lockdownPhrase}
          onChange={e => setLockdownPhrase(e.target.value)}
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. LOCKMYACCOUNT"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Recovery Phrase</label>
        <input
          type="password"
          value={recoveryPhrase}
          onChange={e => setRecoveryPhrase(e.target.value)}
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Enter recovery phrase"
        />
      </div>
    </div>
  );
};

export default Step2Security;
