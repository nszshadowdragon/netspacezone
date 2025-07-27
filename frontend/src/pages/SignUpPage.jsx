// src/pages/SignUpPage.jsx
import React, { useRef, useState, useCallback } from 'react';
import { useNavigate }         from 'react-router-dom';
import axios                   from '../api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { useAuth }             from '../context/AuthContext';
import Step1BasicInfo          from '../components/signup/Step1BasicInfo';
import Step2Security           from '../components/signup/Step2Security';
import Step3ProfileBuild       from '../components/signup/Step3ProfileBuild';

export default function SignUpPage() {
  const navigate      = useNavigate();
  const { login }     = useAuth();
  const step1Ref      = useRef();
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Data,   setStep1Data]   = useState({});
  const [step2Data,   setStep2Data]   = useState({});
  const [step3Data,   setStep3Data]   = useState({});
  const [loading,     setLoading]     = useState(false);

  const handleStep2DataChange = useCallback(d => setStep2Data(d), []);
  const handleStep3DataChange = useCallback(d => setStep3Data(d), []);

  const goToPreviousStep = () => setCurrentStep(s => Math.max(1, s - 1));
  const goToNextStep     = async () => {
    if (currentStep === 1) {
      const valid = await step1Ref.current.validateStep();
      if (!valid) return;
      setStep1Data(step1Ref.current.getValues());
    }
    setCurrentStep(s => Math.min(3, s + 1));
  };

  const handleCancel = () => navigate('/');

  const handleCreateAccount = async () => {
    setLoading(true);
    const payload = {
      ...step1Data,
      ...step2Data,
      ...step3Data
    };

    try {
      // 1) create
      await axios.post('/signup', payload);

      // 2) login
      const loginRes = await axios.post('/login', {
        email:    payload.email,
        password: payload.password
      });
      const data = loginRes.data; // expects { token, user }

      // 3) store in context
      await login(data);

      // 4) go to profile
      navigate('/profile', { replace: true });
    } catch (err) {
      console.error('Signup/Login failed:', err);
      toast.error(err?.response?.data?.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = {
    1: 'Basic Info',
    2: 'Security',
    3: 'Profile Build'
  };

  return (
    <div className="sign-up-page bg-gray-100 h-screen flex items-center justify-center p-4 text-gray-900">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="w-full max-w-lg bg-white p-8 rounded-lg shadow-lg overflow-y-auto max-h-screen">
        {/* Step title */}
        <h2 className="text-3xl font-bold text-center text-blue-600 mb-6">
          {stepLabels[currentStep]}
        </h2>

        {/* Step content */}
        {currentStep === 1 && <Step1BasicInfo ref={step1Ref} />}
        {currentStep === 2 && (
          <Step2Security
            onDataChange={handleStep2DataChange}
            savedData={step2Data}
          />
        )}
        {currentStep === 3 && (
          <Step3ProfileBuild
            onDataChange={handleStep3DataChange}
            savedData={step3Data}
          />
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          {currentStep > 1 ? (
            <button
              onClick={goToPreviousStep}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Back
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          )}

          {currentStep < 3 ? (
            <button
              onClick={goToNextStep}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreateAccount}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 hover:bg-green-700"
            >
              {loading ? 'Creating…' : 'Create Account & Login'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
