function (user, context, callback) {
  if (context.clientName === 'shopify') {
  	const metadata = user.user_metadata || {};
    const shopifyData = metadata.shopify || {};
    context.idToken[`https://${configuration.shopify_store_domain}/password`] =  decrypt(shopifyData.password);
  }

  callback(null, user, context);
  
  function decrypt(text) {
    const IV_LENGTH = 16;
    const NONCE_LENGTH = 5;
    const key = crypto.pbkdf2Sync(configuration.encryption_key, user.user_id, 10000, 32, 'sha512');
    
    let message = Buffer.from(text, 'base64');
    let iv = Buffer.alloc(IV_LENGTH);
    message.copy(iv, 0, 0, NONCE_LENGTH);
    
    let encryptedText = message.slice(NONCE_LENGTH);
    let decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
    let decrypted = decipher.update(encryptedText);
    
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
  
  // See further https://stackoverflow.com/questions/50307269/nodejs-crypto-is-there-any-encrypt-and-decrypt-text-should-give-different-encry
}