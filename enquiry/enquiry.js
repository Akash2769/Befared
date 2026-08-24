
(async () => {
    const OTP_API = "/enquiry/otp_handler.php";
    const RESEND_DELAY_SECONDS = 120;
    const RESEND_LIMIT_MESSAGE = "Maximum OTP resend limit reached. Please refresh the page and submit a new enquiry form.";

    let apiUrl = "/enquiry/process.php";
    let isOtpVerified = false;
    let resendTimer = null;
    let resendCountdown = null;
    let formToken = "";
    let resendRemaining = 3;
    let resendCountdownSecondsLeft = 0;
    let otpErrorMessage = "";
    let showPopup = function () {};
    let showPopupError = function (message) {
        alert(message);
    };

    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");
    const resendOtpBtn = document.getElementById("resendOtpBtn");
    const otpSection = document.getElementById("otpSection");
    const otpInput = document.getElementById("otpInput");
    const otpMessage = document.getElementById("otpMessage");
    const enquiryForm = document.getElementById("enquiryForm");
    const emailField = document.querySelector('input[name="emailid"]');

    function showOtpMessage(message, type) {
        otpMessage.innerHTML = message;
        otpMessage.className = "otp-message " + (type || "");
    }

    function clearOtpMessage() {
        otpMessage.textContent = "";
        otpMessage.className = "otp-message";
    }

    function validateFormFields() {
        if (!enquiryForm.checkValidity()) {
            enquiryForm.reportValidity();
            return false;
        }
        return true;
    }

    function clearResendCountdown() {
        if (resendCountdown) {
            clearInterval(resendCountdown);
            resendCountdown = null;
        }
    }

    function startResendTimer(successMessage) {
        resendOtpBtn.style.display = "none";
        resendOtpBtn.disabled = true;
        if (resendTimer) clearTimeout(resendTimer);
        clearResendCountdown();
        otpErrorMessage = ""; // clear any previous error when new OTP is sent

        resendCountdownSecondsLeft = RESEND_DELAY_SECONDS;

        function buildMessage(secs) {
            if (successMessage && resendRemaining > 0) {
                return `${successMessage}<br>Resend OTP available in ${secs} second(s).`;
            } else if (successMessage) {
                return successMessage;
            } else if (resendRemaining > 0) {
                return `Resend OTP available in ${secs} second(s).`;
            }
            return "";
        }

        // Show immediately
        const initialMsg = buildMessage(resendCountdownSecondsLeft);
        if (initialMsg) {
            showOtpMessage(initialMsg, successMessage ? "success" : "info");
        }

        resendCountdown = setInterval(() => {
            resendCountdownSecondsLeft -= 1;
            if (resendCountdownSecondsLeft > 0) {
                if (resendRemaining > 0) {
                    if (otpErrorMessage) {
                        // Error is active — show error + countdown together
                        _showErrorWithCountdown();
                    } else {
                        showOtpMessage(buildMessage(resendCountdownSecondsLeft), successMessage ? "success" : "info");
                    }
                }
            } else {
                clearResendCountdown();
                resendCountdownSecondsLeft = 0;
                if (resendRemaining > 0) {
                    resendOtpBtn.style.display = "inline-block";
                    resendOtpBtn.disabled = false;
                    if (otpErrorMessage) {
                        showOtpMessage(otpErrorMessage, "error");
                    } else {
                        showOtpMessage("You can now resend OTP if needed.", "info");
                    }
                }
            }
        }, 1000);

        resendTimer = setTimeout(() => {
            if (resendRemaining > 0) {
                resendOtpBtn.style.display = "inline-block";
                resendOtpBtn.disabled = false;
            }
        }, RESEND_DELAY_SECONDS * 1000);
    }

    function detectPageRefresh() {
        if (sessionStorage.getItem("enquiryFormRefresh") === "1") {
            return true;
        }
        const navEntry = performance.getEntriesByType("navigation")[0];
        return navEntry && navEntry.type === "reload";
    }

    function clearAllFormFields() {
        enquiryForm.reset();
        enquiryForm.querySelectorAll("input, textarea, select").forEach((field) => {
            if (field.type === "file") {
                field.value = "";
            } else if (field.type === "hidden" && field.name === "MIDHoney") {
                field.value = "";
            } else if (field.tagName === "SELECT") {
                field.selectedIndex = 0;
            } else if (field.type !== "reset" && field.type !== "button" && field.type !== "submit") {
                field.value = "";
            }
        });
        otpInput.value = "";
    }

    function resetCountrySelect() {
        const countrySelect = document.querySelector('select[name="country"]');
        if (countrySelect && countrySelect.options.length > 0) {
            countrySelect.selectedIndex = 0;
        }
    }

    function showOtpStep(successMessage) {
        otpSection.style.display = "block";
        sendOtpBtn.style.display = "none";
        verifyOtpBtn.style.display = "inline-block";
        otpInput.value = "";
        otpInput.focus();
        startResendTimer(successMessage);
    }

    function resetOtpFlow() {
        isOtpVerified = false;
        otpSection.style.display = "none";
        sendOtpBtn.style.display = "inline-block";
        sendOtpBtn.disabled = false;
        verifyOtpBtn.style.display = "none";
        resendOtpBtn.style.display = "none";
        resendOtpBtn.disabled = false;
        resendOtpBtn.textContent = "Resend OTP";
        otpInput.value = "";
        resendRemaining = 3;
        clearOtpMessage();
        if (resendTimer) clearTimeout(resendTimer);
        clearResendCountdown();
    }

    async function handleSessionInvalidate(message) {
        isOtpVerified = false;
        otpSection.style.display = "none";
        otpInput.value = "";
        sendOtpBtn.style.display = "inline-block";
        sendOtpBtn.disabled = true;
        verifyOtpBtn.style.display = "none";
        verifyOtpBtn.disabled = true;
        resendOtpBtn.style.display = "none";
        resendOtpBtn.disabled = true;
        if (resendTimer) clearTimeout(resendTimer);
        clearResendCountdown();

        // Reset session on server with reset_session action (logs PAGE_RESET)
        await initOtpSession("reset_session");

        // Show message with 5 second countdown then reload page
        let countdown = 5;
        const displayMsg = message || RESEND_LIMIT_MESSAGE;
        showOtpMessage(`${displayMsg}<br>Page reloading in ${countdown} seconds...`, "error");

        const reloadInterval = setInterval(() => {
            countdown -= 1;
            if (countdown > 0) {
                showOtpMessage(`${displayMsg}<br>Page reloading in ${countdown} seconds...`, "error");
            } else {
                clearInterval(reloadInterval);
                window.location.reload();
            }
        }, 1000);
    }

    async function initOtpSession(action = "init") {
        try {
            const formData = new FormData();
            formData.append("action", action);

            const response = await fetch(OTP_API, { method: "POST", body: formData });
            const result = await response.json();

            if (result.status === "success" && result.form_token) {
                formToken = result.form_token;
                if (typeof result.max_resend === "number") {
                    resendRemaining = result.max_resend;
                }
            }
        } catch (error) {
            console.error("Failed to initialize OTP session:", error);
        }
    }

    async function handlePageLoad() {
        sessionStorage.removeItem("enquiryFormRefresh");

        resetOtpFlow();
        formToken = "";
        clearAllFormFields();
        await initOtpSession();
    }

    async function logFormSubmission(email, submitStatus, details) {
        try {
            const formData = new FormData();
            formData.append("action", "log_form_submit");
            formData.append("email", email);
            formData.append("submit_status", submitStatus);
            formData.append("details", details);
            if (formToken) {
                formData.append("form_token", formToken);
            }
            await fetch(OTP_API, { method: "POST", body: formData });
        } catch (error) {
            console.error("Failed to log form submission:", error);
        }
    }

    function appendSecurityFields(formData) {
        formData.append("form_token", formToken);
    }

    async function requestOtp(isResend) {
        clearOtpMessage();
        if (!validateFormFields()) return;

        const email = emailField.value.trim();
        const activeBtn = isResend ? resendOtpBtn : sendOtpBtn;
        activeBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append("action", "send_otp");
            formData.append("email", email);
            formData.append("is_resend", isResend ? "1" : "0");
            appendSecurityFields(formData);

            const response = await fetch(OTP_API, { method: "POST", body: formData });
            const result = await response.json();

            if (result.session_invalidate) {
                await handleSessionInvalidate(result.message);
                return;
            }

            if (result.status === "success") {
                if (typeof result.resend_remaining === "number") {
                    resendRemaining = result.resend_remaining;
                }
                if (isResend) {
                    otpInput.value = "";
                    otpInput.focus();
                    if (resendRemaining > 0) {
                        // Pass success message so timer shows it first, then switches to countdown
                        startResendTimer(result.message);
                    } else {
                        showOtpMessage(result.message, "success");
                    }
                } else {
                    // Pass success message into showOtpStep via startResendTimer
                    showOtpStep(result.message);
                }
                if (resendRemaining <= 0) {
                    resendOtpBtn.style.display = "none";
                }
            } else {
                showOtpMessage(result.message, "error");
                if (result.wait_seconds && resendRemaining > 0) {
                    startResendTimer();
                }
            }
        } catch (error) {
            showOtpMessage("Failed to send OTP. Please try again.", "error");
        } finally {
            activeBtn.disabled = false;
        }
    }

    async function sendOtp() {
        await requestOtp(false);
    }

    async function resendOtp() {
        if (resendRemaining <= 0) {
            await handleSessionInvalidate(RESEND_LIMIT_MESSAGE);
            return;
        }
        await requestOtp(true);
    }

    async function verifyOtp() {
        clearOtpMessage();
        const email = emailField.value.trim();
        const otp = otpInput.value.trim();

        if (!otp || otp.length !== 6) {
            otpErrorMessage = "Please enter a valid 6-digit OTP.";
            _showErrorWithCountdown();
            return;
        }

        verifyOtpBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append("action", "verify_otp");
            formData.append("email", email);
            formData.append("otp", otp);
            appendSecurityFields(formData);

            const response = await fetch(OTP_API, { method: "POST", body: formData });
            const result = await response.json();

            if (result.session_invalidate) {
                await handleSessionInvalidate(result.message);
                return;
            }

            if (result.status === "success") {
                isOtpVerified = true;
                // Stop countdown timer so it doesn't overwrite the success message
                clearResendCountdown();
                if (resendTimer) clearTimeout(resendTimer);
                showOtpMessage(result.message, "success");
                verifyOtpBtn.style.display = "none";
                resendOtpBtn.style.display = "none";
                await new Promise(resolve => setTimeout(resolve, 2000));
                await submitForm();
            } else {
                // Show error + restart countdown together so interval doesn't overwrite error
                otpErrorMessage = result.message;
                _showErrorWithCountdown();
            }
        } catch (error) {
            otpErrorMessage = "Failed to verify OTP. Please try again.";
            _showErrorWithCountdown();
        } finally {
            verifyOtpBtn.disabled = false;
        }
    }

    function _showErrorWithCountdown() {
        // Get remaining seconds from existing countdown (resendCountdown is still running)
        // We restart countdown display with error message combined
        if (otpErrorMessage) {
            // Read current secondsLeft from a shared variable
            const combined = resendCountdownSecondsLeft > 0
                ? `${otpErrorMessage}<br>Resend OTP available in ${resendCountdownSecondsLeft} second(s).`
                : otpErrorMessage;
            showOtpMessage(combined, "error");
        }
    }

    async function submitForm() {
        if (!isOtpVerified) return;

        const email = emailField.value.trim();
        const formData = new FormData(enquiryForm);

        document.getElementById("loadingIndicator").style.display = "block";

        try {
            const prepData = new FormData();
            prepData.append("action", "prepare_submit");
            prepData.append("email", email);
            appendSecurityFields(prepData);

            const prepResponse = await fetch(OTP_API, { method: "POST", body: prepData });
            const prepResult = await prepResponse.json();

            if (prepResult.session_invalidate) {
                document.getElementById("loadingIndicator").style.display = "none";
                await handleSessionInvalidate(prepResult.message);
                return;
            }

            if (prepResult.status !== "success") {
                document.getElementById("loadingIndicator").style.display = "none";
                showOtpMessage(prepResult.message, "error");
                resetOtpFlow();
                return;
            }

            const originalData = {};
            const customData = {};
            enquiryForm.querySelectorAll("[data-name]").forEach((input) => {
                if (input.type !== "file") {
                    const customName = input.getAttribute("data-name");
                    const key = input.name;
                    const value = input.value;
                    originalData[key] = value;
                    customData[customName] = value;
                }
            });

            originalData["q"] = prepResult.captcha_token;
            formData.append("originalData", JSON.stringify(originalData));
            formData.append("customData", JSON.stringify(customData));

            const response = await fetch(apiUrl, {
                method: "POST",
                body: formData,
            });

            const result = await response.json();
            document.getElementById("loadingIndicator").style.display = "none";

            if (result.status === "success") {
                await logFormSubmission(email, "success", "Enquiry form submitted successfully via process.php");
                showPopup("Form submitted successfully!");
            } else if (result.status === "error") {
                await logFormSubmission(email, "failed", result.message || "Form submission failed");
                showPopupError(result.message);
            } else {
                await logFormSubmission(email, "failed", "Unknown response from process.php");
                showPopupError("Something went wrong. Please try again.");
            }
        } catch (error) {
            document.getElementById("loadingIndicator").style.display = "none";
            await logFormSubmission(email, "failed", "API error during form submission");
            showPopupError("Something went wrong in api. Please try again.");
        }
    }

    window.addEventListener("beforeunload", () => {
        sessionStorage.setItem("enquiryFormRefresh", "1");
    });

    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            clearAllFormFields();
            resetOtpFlow();
            resetCountrySelect();
            initOtpSession();
        }
    });

    await handlePageLoad();

    sendOtpBtn.addEventListener("click", sendOtp);
    verifyOtpBtn.addEventListener("click", verifyOtp);
    resendOtpBtn.addEventListener("click", resendOtp);

    emailField.addEventListener("change", () => {
        if (otpSection.style.display !== "none") {
            resetOtpFlow();
            showOtpMessage("Email changed. Please request a new OTP.", "error");
        }
    });

    enquiryForm.addEventListener("reset", () => {
        resetOtpFlow();
    });

    enquiryForm.addEventListener("submit", (e) => {
        e.preventDefault();
    });

    try {
        const apiResponse = await fetch("/enquiry/ip_process.php");

        if (!apiResponse.ok) {
            console.error("Failed to fetch API data", apiResponse.status);
            return;
        }

        const apiData = await apiResponse.json();
        const isIpInArray = apiData.is_ip_in_array;
        const countries = apiData.countries;

        const countrySelect = document.querySelector('select[name="country"]');
        countrySelect.innerHTML = '<option value="" selected disabled>Select a country</option>';

        for (const countryCode in countries) {
            if (countries.hasOwnProperty(countryCode)) {
                const countryName = countries[countryCode];
                const option = document.createElement("option");
                option.value = countryName;
                option.textContent = countryName;
                countrySelect.appendChild(option);
            }
        }

        resetCountrySelect();

        if (!isIpInArray) {
            apiUrl = "another-url.php";
        }

        showPopup = function () {
            const popup = document.createElement("div");
            popup.style.position = "fixed";
            popup.style.top = "50%";
            popup.style.left = "50%";
            popup.style.transform = "translate(-50%, -50%)";
            popup.style.zIndex = "9999";

            popup.innerHTML = `<style>.path{fill: transparent; stroke: #fff; stroke-width: 2; stroke-dasharray: 25; stroke-dashoffset: 0; stroke-linecap: round; stroke-linejoin: round; animation: animate 1s cubic-bezier(0, 0, 0.32, -0.13) infinite} @keyframes animate{from{stroke - dashoffset: 26} to{stroke - dashoffset: 0}} .box{margin - right: auto; margin-left: auto; border: 1px solid #bfbfbf; width: 100%;background:#fffefa; box-shadow: 0 0 10px #bfbfbf;} @media (max-width:768px){ .box{width: 100%;}} </style>
                    <div style="display: flex; align-items: center; justify-content: center; height: 95vh;">
                        <div class="row justify-content-center box">
                            <div style="background-color: #fffefa; color: #183d3d; font-family: 'Poppins', sans-serif; margin: 20px; text-align: center;">
                                <div style="text-align: center; padding: 25px 0;">
                                    <div style="background: #53bf8b; width: 100px; height: 100px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                                        <svg class="svg" width="85px" version="1.1" id="tick" viewBox="6 5 26 26">
                                            <polyline class="path" points="11.6,20 15.9,24.2 26.4,13.8 " />
                                        </svg>
                                    </div>
                                </div>
                                <div class="thank-you-message">
                                    <h1>Thank You for Your Enquiry!</h1>
                                    <p class="thank-you-subtext">We've received your request and will get back to you shortly.</p>
                                </div>
                                <hr style="border-color: #eee;">
                                    <maha style="display: inline-flex; align-items: center;">
                                        <svg xmlns="http://www.w3.org/2000/svg" height="30" width="30" xml:space="preserve" width="3.33333in"
                                            height="3.33333in" version="1.1"
                                            style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"
                                            viewBox="0 0 3333.33 3333.33" xmlns:xlink="http://www.w3.org/1999/xlink"
                                            xmlns:xodm="http://www.corel.com/coreldraw/odm/2003">
                                            <g id="Layer_x0020_1">
                                                <metadata id="CorelCorpID_0Corel-Layer" />
                                                <g id="_2143040848416">
                                                    <g>
                                                        <path fill="#E31E24"
                                                            d="M2609.33 893.72l-759.07 813.85 -2.22 -876.02 -1051.12 1199.17c-61.31,-135.58 -95.46,-285.63 -95.46,-443.32 0,-601.29 495.94,-1091.7 1104,-1091.7 326.11,0 619.96,141.06 822.37,364.61 1.04,1.15 3.89,4.61 5.54,6.91l-24.03 26.5zm-1730.51 1284.28c-0.61,-0.85 -1.22,-1.69 -1.83,-2.54l1.83 2.54zm1727.02 159.99c-0.05,0.06 -0.1,0.11 -0.15,0.17 0.05,-0.06 0.1,-0.11 0.15,-0.17zm-0.44 0.45c-0.08,0.08 -0.17,0.17 -0.25,0.26 0.08,-0.09 0.17,-0.17 0.25,-0.26zm-0.44 0.45c-0.05,0.05 -0.09,0.1 -0.14,0.15 0.05,-0.05 0.09,-0.1 0.14,-0.15zm-0.42 0.43c-201.33,209.09 -485.25,339.76 -799.09,339.76 -382.85,0 -721.17,-194.46 -919.32,-488.56 0.17,0.26 0.34,0.52 0.52,0.78l-552.14 628.63 -1.55 -268.72 462.01 -524.84c0.65,1.44 1.29,2.89 1.94,4.33l-0.02 0.02c19.44,44.45 41.44,87.65 69.28,129.11 -0.09,-0.13 -0.17,-0.26 -0.25,-0.39 5.13,7.67 10.47,15.28 16.03,22.82 0.01,0.01 0.02,0.03 0.03,0.04l1722.56 157.02zm-1721.57 -153.52c-2.35,-3.52 -4.67,-7.05 -6.98,-10.6 2.31,3.55 4.64,7.08 6.98,10.6zm-8.91 -13.59c-2.52,-3.9 -5.02,-7.82 -7.49,-11.76 2.47,3.94 4.97,7.86 7.49,11.76zm7.96 10.13c0.01,0 0.01,0.01 0.01,0.01 0,0.01 0.02,0.02 0.02,0.03 0.02,0.02 0.03,0.04 0.04,0.06 0.13,0.18 0.27,0.37 0.41,0.55 0,0 0,0 0,0 0.01,0.01 0.02,0.03 0.03,0.04 0.01,0.01 0.02,0.02 0.03,0.04 0,0 0,0 0,0.01 0.04,0.05 0.07,0.09 0.11,0.14 0,0 0,0.01 0.01,0.02 0.02,0.03 0.04,0.05 0.06,0.08 0,0 0,0 0,0 0.01,0.02 0.02,0.04 0.03,0.05 0.01,0.01 0.02,0.02 0.03,0.04 0,0 0,0.01 0,0.01 0.06,0.07 0.12,0.16 0.17,0.24 0,0 0.01,0.01 0.01,0.02 0.01,0.01 0.01,0.02 0.02,0.03 0.01,0.01 0.02,0.02 0.03,0.04 0,0 0,0.01 0,0.01 0.37,0.5 0.75,1 1.12,1.51 0,0 0,0 0.01,0.01 0.02,0.03 0.04,0.06 0.07,0.09 0.01,0.02 0.02,0.04 0.04,0.05 0,0 0,0 0.01,0.01 0,0 0,0 0,0.01 0.02,0.02 0.03,0.04 0.04,0.05 0.01,0.02 0.03,0.04 0.04,0.06 0,0 0.01,0.01 0.01,0.01 0.01,0.02 0.03,0.03 0.04,0.05 0.02,0.03 0.04,0.06 0.06,0.09 0,0 0.01,0.01 0.01,0.02 0.07,0.09 0.13,0.18 0.2,0.26 0,0 0,0.01 0.01,0.01 0.01,0.02 0.02,0.03 0.04,0.05 0,0 0.01,0.01 0.01,0.01 0.09,0.13 0.19,0.24 0.28,0.37 0.02,0.03 0.04,0.06 0.07,0.1 0.01,0.02 0.03,0.03 0.04,0.05 0.01,0.02 0.02,0.03 0.04,0.05 0.01,0 0.01,0.01 0.01,0.02 0.02,0.02 0.04,0.04 0.05,0.07 0,0 0,0 0.01,0.01 0.01,0.01 0.01,0.02 0.02,0.03 0.01,0.01 0.01,0.01 0.02,0.02 0.02,0.02 0.04,0.05 0.06,0.07 0,0.01 0.01,0.01 0.02,0.02 0.01,0.02 0.02,0.03 0.04,0.04 0.01,0.02 0.02,0.04 0.04,0.05 0.02,0.03 0.04,0.06 0.06,0.08 0,0 0,0.01 0.01,0.01 0.01,0.02 0.02,0.03 0.04,0.05 0.01,0.02 0.02,0.03 0.04,0.05 0.02,0.03 0.04,0.06 0.06,0.09 0,0 0.01,0.01 0.01,0.01 0.09,0.13 0.18,0.25 0.28,0.37l699.69 -789.07 7.02 373.99 4.46 237.29 237.26 0 534.13 -546.28 0 873.97 237.84 0 8.69 0 -1.12 -359.09 2.71 360.91 -12.05 0 -1722.53 -156.98zm2.16 2.91c0,0 0,0 0.01,0.01 -0,-0 -0,-0 -0.01,-0.01zm0.12 0.17c0.02,0.02 0.03,0.04 0.04,0.05 -0.02,-0.02 -0.03,-0.04 -0.04,-0.05zm0.21 0.28c0.07,0.09 0.13,0.18 0.2,0.26 -0.06,-0.09 -0.13,-0.17 -0.2,-0.26zm1.14 1.52c0.09,0.13 0.18,0.25 0.28,0.37 -0.09,-0.12 -0.19,-0.25 -0.28,-0.37zm-1.22 -1.62c0.02,0.03 0.04,0.06 0.06,0.09l-0.06 -0.09zm0.85 1.14c0.02,0.02 0.04,0.05 0.06,0.07l-0.06 -0.07zm0.15 0.19c0.02,0.03 0.04,0.06 0.06,0.08l-0.06 -0.08zm0.14 0.19c0.02,0.03 0.04,0.06 0.06,0.09l-0.06 -0.09zm962.47 -1355.59l1.33 526.6 0 -529.55 -1054.4 1197.8c0.65,1.44 1.29,2.89 1.94,4.33l1051.12 -1199.17zm757.7 66.02l-0.09 -12.1 -670.5 731.08 307.35 -329.52 363.24 -389.46zm-670.59 718.98l-0.02 0.02 307.37 -329.55 -307.35 329.52zm674.18 -728.83l7.16 0 231.9 0 0 269.54 -239.06 0 0 -263.54 0 -6.01zm9.56 454.53l219.94 0 0 993.54 -219.94 0 0 -993.54z" />
                                                    </g>
                                                </g>
                                            </g>
                                        </svg>
                                        <div style="padding-left: 5px;"><b>Maharashtra Industries Directory<sup
                                            style="font-size: 0.5rem;">TM</sup></b></div>
                                    </maha>
                            </div>
                        </div>
                    </div>`;

            enquiryForm.reset();
            resetOtpFlow();
            document.body.appendChild(popup);

            setTimeout(() => {
                document.body.removeChild(popup);
                window.location.reload();
                window.location.href = "/";
            }, 3000);
        }

        showPopupError = function (message) {
            const popup1 = document.createElement("div");
            popup1.style.position = "fixed";
            popup1.style.top = "50%";
            popup1.style.left = "50%";
            popup1.style.transform = "translate(-50%, -50%)";
            popup1.style.zIndex = "9999";

            popup1.innerHTML = `<style>.path{ fill: transparent; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;} .box{ margin-right: auto; margin-left: auto; border: 1px solid #bfbfbf; box-shadow: 0 0 10px #bfbfbf;} @media (max-width: 768px){ .box{ width: 100%;}} .cross-wrapper{ background: #e74c3c; width: 85px; height: 85px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; position: relative; animation: animateCross 1s cubic-bezier(0, 0, 0.32, -0.13) infinite;} .cross{ position: relative;} .cross:before{ transform: rotate(45deg);} .cross:after{ transform: rotate(-45deg);} @keyframes animateCross{ 0%{ transform: scale(1);} 50%{ transform: scale(1.1);} 100%{ transform: scale(1);}} @keyframes animateLines{ 0%{ opacity: 0; transform: scale(0.5);} 50%{ opacity: 1; transform: scale(1.1);} 100%{ opacity: 0; transform: scale(0.5);}} </style><div style="display: flex; align-items: center; justify-content: center;"><div class="row justify-content-center box"><div style="background-color: #fffefa; color: #183d3d; font-family: 'Poppins', sans-serif; margin: 20px; text-align: center;"><div style="text-align: center; padding: 25px 0 0;"><div class="cross-wrapper"><div class="cross" ><svg fill="#ffffff" height="45px" width="45px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g><g><polygon points="512,59.076 452.922,0 256,196.922 59.076,0 0,59.076 196.922,256 0,452.922 59.076,512 256,315.076 452.922,512 512,452.922 315.076,256 "></polygon></g></g></g></svg></div></div><div class="thank-you-message" style="margin-top: 35px;"><h1>Somethine Went Wrong!</h1><p class="thank-you-subtext">${message}</p></div><hr style="border-color: #eee;"><maha style="display: inline-flex; align-items: center; "><svg xmlns="http://www.w3.org/2000/svg" height="30" width="30" xml:space="preserve" width="3.33333in" height="3.33333in" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 3333.33 3333.33" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xodm="http://www.corel.com/coreldraw/odm/2003"><g id="Layer_x0020_1"><metadata id="CorelCorpID_0Corel-Layer" /><g id="_2143040848416"><g><path fill="#E31E24" d="M2609.33 893.72l-759.07 813.85 -2.22 -876.02 -1051.12 1199.17c-61.31,-135.58 -95.46,-285.63 -95.46,-443.32 0,-601.29 495.94,-1091.7 1104,-1091.7 326.11,0 619.96,141.06 822.37,364.61 1.04,1.15 3.89,4.61 5.54,6.91l-24.03 26.5zm-1730.51 1284.28c-0.61,-0.85 -1.22,-1.69 -1.83,-2.54l1.83 2.54zm1727.02 159.99c-0.05,0.06 -0.1,0.11 -0.15,0.17 0.05,-0.06 0.1,-0.11 0.15,-0.17zm-0.44 0.45c-0.08,0.08 -0.17,0.17 -0.25,0.26 0.08,-0.09 0.17,-0.17 0.25,-0.26zm-0.44 0.45c-0.05,0.05 -0.09,0.1 -0.14,0.15 0.05,-0.05 0.09,-0.1 0.14,-0.15zm-0.42 0.43c-201.33,209.09 -485.25,339.76 -799.09,339.76 -382.85,0 -721.17,-194.46 -919.32,-488.56 0.17,0.26 0.34,0.52 0.52,0.78l-552.14 628.63 -1.55 -268.72 462.01 -524.84c0.65,1.44 1.29,2.89 1.94,4.33l-0.02 0.02c19.44,44.45 41.44,87.65 69.28,129.11 -0.09,-0.13 -0.17,-0.26 -0.25,-0.39 5.13,7.67 10.47,15.28 16.03,22.82 0.01,0.01 0.02,0.03 0.03,0.04l1722.56 157.02zm-1721.57 -153.52c-2.35,-3.52 -4.67,-7.05 -6.98,-10.6 2.31,3.55 4.64,7.08 6.98,10.6zm-8.91 -13.59c-2.52,-3.9 -5.02,-7.82 -7.49,-11.76 2.47,3.94 4.97,7.86 7.49,11.76zm7.96 10.13c0.01,0 0.01,0.01 0.01,0.01 0,0.01 0.02,0.02 0.02,0.03 0.02,0.02 0.03,0.04 0.04,0.06 0.13,0.18 0.27,0.37 0.41,0.55 0,0 0,0 0,0 0.01,0.01 0.02,0.03 0.03,0.04 0.01,0.01 0.02,0.02 0.03,0.04 0,0 0,0 0,0.01 0.04,0.05 0.07,0.09 0.11,0.14 0,0 0,0.01 0.01,0.02 0.02,0.03 0.04,0.05 0.06,0.08 0,0 0,0 0,0 0.01,0.02 0.02,0.04 0.03,0.05 0.01,0.01 0.02,0.02 0.03,0.04 0,0 0,0.01 0,0.01 0.06,0.07 0.12,0.16 0.17,0.24 0,0 0.01,0.01 0.01,0.02 0.01,0.01 0.01,0.02 0.02,0.03 0.01,0.01 0.02,0.02 0.03,0.04 0,0 0,0.01 0,0.01 0.37,0.5 0.75,1 1.12,1.51 0,0 0,0 0.01,0.01 0.02,0.03 0.04,0.06 0.07,0.09 0.01,0.02 0.02,0.04 0.04,0.05 0,0 0,0 0.01,0.01 0,0 0,0 0,0.01 0.02,0.02 0.03,0.04 0.04,0.05 0.01,0.02 0.03,0.04 0.04,0.06 0,0 0.01,0.01 0.01,0.01 0.01,0.02 0.03,0.03 0.04,0.05 0.02,0.03 0.04,0.06 0.06,0.09 0,0 0.01,0.01 0.01,0.02 0.07,0.09 0.13,0.18 0.2,0.26 0,0 0,0.01 0.01,0.01 0.01,0.02 0.02,0.03 0.04,0.05 0,0 0.01,0.01 0.01,0.01 0.09,0.13 0.19,0.24 0.28,0.37 0.02,0.03 0.04,0.06 0.07,0.1 0.01,0.02 0.03,0.03 0.04,0.05 0.01,0.02 0.02,0.03 0.04,0.05 0.01,0 0.01,0.01 0.01,0.02 0.02,0.02 0.04,0.04 0.05,0.07 0,0 0,0 0.01,0.01 0.01,0.01 0.01,0.02 0.02,0.03 0.01,0.01 0.01,0.01 0.02,0.02 0.02,0.02 0.04,0.05 0.06,0.07 0,0.01 0.01,0.01 0.02,0.02 0.01,0.02 0.02,0.03 0.04,0.04 0.01,0.02 0.02,0.04 0.04,0.05 0.02,0.03 0.04,0.06 0.06,0.08 0,0 0,0.01 0.01,0.01 0.01,0.02 0.02,0.03 0.04,0.05 0.01,0.02 0.02,0.03 0.04,0.05 0.02,0.03 0.04,0.06 0.06,0.09 0,0 0.01,0.01 0.01,0.01 0.09,0.13 0.18,0.25 0.28,0.37l699.69 -789.07 7.02 373.99 4.46 237.29 237.26 0 534.13 -546.28 0 873.97 237.84 0 8.69 0 -1.12 -359.09 2.71 360.91 -12.05 0 -1722.53 -156.98zm2.16 2.91c0,0 0,0 0.01,0.01 -0,-0 -0,-0 -0.01,-0.01zm0.12 0.17c0.02,0.02 0.03,0.04 0.04,0.05 -0.02,-0.02 -0.03,-0.04 -0.04,-0.05zm0.21 0.28c0.07,0.09 0.13,0.18 0.2,0.26 -0.06,-0.09 -0.13,-0.17 -0.2,-0.26zm1.14 1.52c0.09,0.13 0.18,0.25 0.28,0.37 -0.09,-0.12 -0.19,-0.25 -0.28,-0.37zm-1.22 -1.62c0.02,0.03 0.04,0.06 0.06,0.09l-0.06 -0.09zm0.85 1.14c0.02,0.02 0.04,0.05 0.06,0.07l-0.06 -0.07zm0.15 0.19c0.02,0.03 0.04,0.06 0.06,0.08l-0.06 -0.08zm0.14 0.19c0.02,0.03 0.04,0.06 0.06,0.09l-0.06 -0.09zm962.47 -1355.59l1.33 526.6 0 -529.55 -1054.4 1197.8c0.65,1.44 1.29,2.89 1.94,4.33l1051.12 -1199.17zm757.7 66.02l-0.09 -12.1 -670.5 731.08 307.35 -329.52 363.24 -389.46zm-670.59 718.98l-0.02 0.02 307.37 -329.55 -307.35 329.52zm674.18 -728.83l7.16 0 231.9 0 0 269.54 -239.06 0 0 -263.54 0 -6.01zm9.56 454.53l219.94 0 0 993.54 -219.94 0 0 -993.54z" /></g></g></svg><div style="padding-left: 5px;"><b>Maharashtra Industries Directory<sup style="font-size: 0.5rem;">TM</sup></b></div></maha></div></div></div></div>`;

            document.body.appendChild(popup1);

            setTimeout(() => {
                document.body.removeChild(popup1);
            }, 3000);
        }

    } catch (error) {
        console.error("Error in fetching or processing data:", error);
    }
})();
