function (user, context, callback) {
  if (context.clientName === 'discourse') {
  	const metadata = user.user_metadata || {};
    const discourseData = metadata.discourse || {};

    Object.keys(discourseData).forEach(k => {
      let val = discourseData[k];
      if (Array.isArray(val)) val = val.join(',');
      context.idToken["https://" + configuration.discourse_domain + `/${k}`] = val;
    });
  }
  callback(null, user, context);
}