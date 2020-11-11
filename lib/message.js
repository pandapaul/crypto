const encrypt = text => {
	let encryptedText = ''
	let hint = ''
	var unique = []
	var cryptoChars = []
	var alphabet = ['a','b','c','d','e','f','g','h',
					'i','j','k','l','m','n','o','p',
					'q','r','s','t','u','v','w','x',
					'y','z']
	var alphaRemaining = alphabet.slice(0)
	console.log('text', text)
	for (var i = 0; i < text.length; i++) {
		var c = text[i]
		if(alphabet.indexOf(c) !== -1) {
			if(unique.indexOf(c) === -1) {
				unique.push(c)
				var randomAlpha = alphaRemaining.splice(Math.floor(Math.random()*alphaRemaining.length),1)
				cryptoChars.push(randomAlpha)
			}
			encryptedText += cryptoChars[unique.indexOf(c)]
		} else {
			encryptedText += c
		}
	}
	var randomHintIndex = Math.floor(Math.random()*cryptoChars.length)
	if(cryptoChars.length>0) {
		hint = cryptoChars[randomHintIndex] + ' = ' + unique[randomHintIndex]
	} else {
		hint = ''
	}
	return {
		encryptedText,
		hint
	}
}

module.exports = ({ text, burnable, limited }) => {
	const { encryptedText, hint } = encrypt(text)
	return {
		text,
		burnable,
		limited,
		encryptedText,
		hint
	}
}
