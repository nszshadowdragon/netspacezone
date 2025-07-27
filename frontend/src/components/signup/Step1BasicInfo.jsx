import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle
} from "react";
import zxcvbn from "zxcvbn";

const takenUsernames = ["admin", "testuser", "netspace"];

const Step1BasicInfo = forwardRef((_, ref) => {
  /* ─── form state ───────────────────────────────── */
  const [email, setEmail]             = useState("");
  const [username, setUsername]       = useState("");
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [birthday, setBirthday]       = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirm] = useState("");

  /* ─── UI helpers ──────────────────────────────── */
  const [showPassword,  setShowPassword]  = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [usernameOK,    setUsernameOK]    = useState(null);
  const [suggestions,   setSuggestions]   = useState([]);
  const [error,         setError]         = useState("");
  const [touched,       setTouched]       = useState({});

  const inputRefs = {
    email:     useRef(),
    username:  useRef(),
    firstName: useRef(),
    lastName:  useRef(),
    birthday:  useRef(),
    password:  useRef(),
    confirm:   useRef()
  };

  /* ─── helpers ──────────────────────────────────── */
  const getAge  = dob =>
    dob ? new Date(Date.now() - new Date(dob)).getUTCFullYear() - 1970 : 0;
  const isAdult = dob => getAge(dob) >= 18;

  const pwdRules = {
    len:  password.length >= 8 && password.length <= 30,
    upp:  /[A-Z]/.test(password),
    low:  /[a-z]/.test(password),
    num:  /[0-9]/.test(password),
    sym:  /[@$!%*?#&_]/.test(password)
  };
  const pwdValid = Object.values(pwdRules).every(Boolean);
  const emailOK  = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const genSuggestions = base => {
    const out = [];
    while (out.length < 3) {
      const cand = base + Math.floor(Math.random() * 1000);
      if (!takenUsernames.includes(cand.toLowerCase())) out.push(cand);
    }
    return out;
  };

  const onUsernameChange = e => {
    const v = e.target.value;
    if (v.length <= 30) {
      setUsername(v);
      if (v.length >= 3) {
        if (takenUsernames.includes(v.toLowerCase())) {
          setUsernameOK(false);
          setSuggestions(genSuggestions(v));
        } else {
          setUsernameOK(true);
          setSuggestions([]);
        }
      } else setUsernameOK(null);
    }
  };

  /* ─── validation ──────────────────────────────── */
  const validateAll = () => {
    const errs = {
      email:           !emailOK(email),
      username:        username.length < 3 || username.length > 30 || usernameOK === false,
      firstName:       !firstName.trim(),
      lastName:        !lastName.trim(),
      birthday:        !birthday || !isAdult(birthday),
      password:        !pwdValid,
      confirmPassword: confirmPassword !== password
    };
    setTouched(errs);

    if (Object.values(errs).some(Boolean)) {
      const msg =
        errs.email           ? "Enter a valid email address." :
        errs.username        ? "Username must be 3–30 chars and not taken." :
        errs.firstName       ? "First name is required." :
        errs.lastName        ? "Last name is required." :
        errs.birthday        ? "You must be at least 18 years old." :
        errs.password        ? "Password does not meet requirements." :
                               "Passwords do not match.";
      setError(msg);
      return false;
    }
    setError("");
    return true;
  };

  /* ─── expose to parent ─────────────────────────── */
  useImperativeHandle(ref, () => ({
    validateStep: validateAll,
    getValues: () => ({
      email,
      username,
      firstName,
      lastName,
      birthday,
      password,
      confirmPassword
    })
  }));

  const clearBtn = (field, setter) => (
    <button
      type="button"
      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      onClick={() => {
        setter("");
        setTimeout(() => inputRefs[field]?.current?.focus(), 0);
      }}
    >
      ×
    </button>
  );

  const inpCls = invalid =>
    `w-full text-gray-900 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
      invalid ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <form onSubmit={e => e.preventDefault()} className="space-y-6">
      {error && (
        <div className="bg-red-100 text-red-700 px-3 py-2 rounded">{error}</div>
      )}

      {/* Email */}
      <div className="relative">
        <label className="block mb-1 text-gray-700">Email</label>
        <input
          ref={inputRefs.email}
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={inpCls(touched.email)}
          placeholder="you@example.com"
        />
        {email && clearBtn("email", setEmail)}
      </div>

      {/* Username */}
      <div className="relative">
        <label className="block mb-1 text-gray-700">Username</label>
        <input
          ref={inputRefs.username}
          value={username}
          onChange={onUsernameChange}
          className={inpCls(touched.username)}
          placeholder="Choose a username"
        />
        {username && clearBtn("username", setUsername)}
        <p className="text-xs mt-1">
          {username.length}/30{" "}
          {usernameOK === false && <span className="text-red-500">– taken</span>}
          {usernameOK === true  && <span className="text-green-600">– available</span>}
        </p>
        {!usernameOK && suggestions.length > 0 && (
          <div className="mt-1 space-y-1">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onUsernameChange({ target: { value: s } })}
                className="text-blue-600 text-sm hover:underline"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* First Name */}
      <div className="relative">
        <label className="block mb-1 text-gray-700">First Name</label>
        <input
          ref={inputRefs.firstName}
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          className={inpCls(touched.firstName)}
          placeholder="Your first name"
        />
        {firstName && clearBtn("firstName", setFirstName)}
      </div>

      {/* Last Name */}
      <div className="relative">
        <label className="block mb-1 text-gray-700">Last Name</label>
        <input
          ref={inputRefs.lastName}
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          className={inpCls(touched.lastName)}
          placeholder="Your last name"
        />
        {lastName && clearBtn("lastName", setLastName)}
      </div>

      {/* Birthday */}
      <div className="relative">
        <label className="block mb-1 text-gray-700">Birthday</label>
        <input
          ref={inputRefs.birthday}
          type="date"
          max={new Date().toISOString().split("T")[0]}
          value={birthday}
          onChange={e => setBirthday(e.target.value)}
          className={inpCls(touched.birthday)}
        />
        {birthday && (
          <p className="text-xs mt-1">
            {isAdult(birthday)
              ? `Age: ${getAge(birthday)} ✅`
              : `Must be 18+ — ${getAge(birthday)}`}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="relative">
        <label className="block mb-1 text-gray-700">Password</label>
        <input
          ref={inputRefs.password}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={`${inpCls(touched.password)} pr-10`}
          placeholder="Create a password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(v => !v)}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-blue-500 text-sm"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
        {password && clearBtn("password", setPassword)}

        {password && (
          <div className="mt-2 text-xs space-y-1">
            <p className={pwdRules.len ? "text-green-600" : "text-red-500"}>
              • 8–30 chars
            </p>
            <p className={pwdRules.upp ? "text-green-600" : "text-red-500"}>
              • 1 uppercase letter
            </p>
            <p className={pwdRules.low ? "text-green-600" : "text-red-500"}>
              • 1 lowercase letter
            </p>
            <p className={pwdRules.num ? "text-green-600" : "text-red-500"}>
              • 1 number
            </p>
            <p className={pwdRules.sym ? "text-green-600" : "text-red-500"}>
              • 1 special char
            </p>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div className="relative">
        <label className="block mb-1 text-gray-700">Confirm Password</label>
        <input
          ref={inputRefs.confirm}
          type={showConfirm ? "text" : "password"}
          value={confirmPassword}
          onChange={e => setConfirm(e.target.value)}
          className={`${inpCls(touched.confirmPassword)} pr-10`}
          placeholder="Re-enter password"
        />
        <button
          type="button"
          onClick={() => setShowConfirm(v => !v)}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-blue-500 text-sm"
        >
          {showConfirm ? "Hide" : "Show"}
        </button>
        {confirmPassword && clearBtn("confirm", setConfirm)}
        {confirmPassword && (
          <p
            className={`mt-1 text-sm ${
              confirmPassword === password ? "text-green-600" : "text-red-500"
            }`}
          >
            {confirmPassword === password
              ? "Passwords match"
              : "Passwords do not match"}
          </p>
        )}
      </div>
    </form>
  );
});

export default Step1BasicInfo;
