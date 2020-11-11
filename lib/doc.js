module.exports = ({ text, burnable, limited, encryptedText, hint }) => ({
  text,
  encryptedText,
  hint,
  burnable,
  limited,
  date: new Date(),
  timestamp: new Date().getTime(),
  checksLeft: 3,
  allUsers: []
})