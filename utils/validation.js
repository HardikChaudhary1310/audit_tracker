// Email validation
const isValidEmail = (username) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@shivalikbank\.com$/;
    return emailRegex.test(username);
};

// Password validation
const isValidPassword = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    return passwordRegex.test(password);
};

module.exports = {
    isValidEmail,
    isValidPassword
}; 