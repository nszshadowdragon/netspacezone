// SignUpWizard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// import each step
import Step1BasicInfo from "./signup/Step1BasicInfo";
import Step2SecurityTerms from "./signup/Step2SecurityTerms";
import Step3Avatar2FA from "./signup/Step3Avatar2FA";
import Step4Personalize from "./signup/Step4Personalize";
import Step5Review from "./signup/Step5Review";

// build your schema function here (same as before)
function buildSchema(isPasswordless) { /* … */ }

export default function SignUpWizard() {
  const navigate = useNavigate();
  const [wizardStep, setWizardStep] = useState(1);
  const [isPasswordless, setIsPasswordless] = useState(false);
  const [enable2FA, setEnable2FA] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userInterests, setUserInterests] = useState([]);
  const [twoFACode, setTwoFACode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [loadingEmailVerification, setLoadingEmailVerification] = useState(false);

  const formSchema = buildSchema(isPasswordless);
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } =
    useForm({
      mode: "onChange",
      resolver: yupResolver(formSchema),
      defaultValues: {
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        acceptedTOS: false,
        readCommunityGuidelines: false,
        honeypot: "",
      },
    });

  const totalSteps = 5;
  const goNext = () => setWizardStep(s => Math.min(totalSteps, s + 1));
  const goPrev = () => setWizardStep(s => Math.max(1, s - 1));

  // partial save logic, async checks, etc… (copy from your big file)

  const onSubmit = async data => {
    // your final submission logic
    await new Promise(r => setTimeout(r, 1000));
    toast.success("Account created!");
    navigate("/profile");
  };

  return (
    <>
      <ToastContainer />
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl mx-auto p-4 bg-
white rounded shadow">
        {wizardStep === 1 && (
          <Step1BasicInfo
            register={register}
            errors={errors}
            clearErrors={field => clearErrors(field)}
            goNext={goNext}
            isPasswordless={isPasswordless}
            setIsPasswordless={setIsPasswordless}
            watch={watch}
          />
        )}
        {wizardStep === 2 && (
          <Step2SecurityTerms
            register={register}
            errors={errors}
            goNext={goNext}
            goPrev={goPrev}
            enable2FA={enable2FA}
            setEnable2FA={setEnable2FA}
            twoFACode={twoFACode}
            setTwoFACode={setTwoFACode}
            emailVerified={emailVerified}
            loadingEmailVerification={loadingEmailVerification}
            handleSendVerificationEmail={/* … */}
          />
        )}
        {wizardStep === 3 && (
          <Step3Avatar2FA
            goNext={goNext}
            goPrev={goPrev}
            avatarUrl={avatarUrl}
            setAvatarUrl={setAvatarUrl}
            handleGenerateAvatar={/* … */}
          />
        )}
        {wizardStep === 4 && (
          <Step4Personalize
            goNext={goNext}
            goPrev={goPrev}
            userInterests={userInterests}
            setUserInterests={setUserInterests}
          />
        )}
        {wizardStep === 5 && (
          <Step5Review
            goPrev={goPrev}
            isSubmitting={isSubmitting}
          />
        )}
      </form>
    </>
  );
}
