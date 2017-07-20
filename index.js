var express = require('express')
var path = require('path')
var fs = require('fs')
var fetch = require('node-fetch');
var google = require('googleapis');

// configuration
const YOUR_CLIENT_ID = '340726397844-f0c92j7700mml9qrshk6l1dukml2i6p0.apps.googleusercontent.com'
const YOUR_CLIENT_SECRET = 's7xJtfaliR0oiJEFapa81wfI'
const YOUR_REDIRECT_URL = 'http://localhost:3000/auth/google/callback'

// create the client using our configuration
var OAuth2 = google.auth.OAuth2;
var oauth2Client = new OAuth2( YOUR_CLIENT_ID, YOUR_CLIENT_SECRET, YOUR_REDIRECT_URL );


// generate a url that asks permissions for gmail scopes
var url = oauth2Client.generateAuthUrl({
	// 'online' (default) or 'offline' (gets refresh_token)
	access_type: 'offline',

	// If you only need one scope you can pass it as a string
	scope: [
		'https://www.googleapis.com/auth/gmail.readonly',
		'https://www.googleapis.com/auth/userinfo.email',
		'https://www.googleapis.com/auth/userinfo.profile'
	]
});

console.log( url )
///////////////////////////////

// setup the webserver configuration 
var app = express()


// refresh the token if necessary
const refresh_token = fs.readFileSync( path.join(__dirname, 'data', 'token') ).toString()
if( refresh_token ){
	oauth2Client.setCredentials({refresh_token})
	oauth2Client.refreshAccessToken(function(err, tokens) {
		console.log( tokens, oauth2Client.credentials )		
	});
}

// show the google form to grant access
app.get('/', function (req, res) {
	if( oauth2Client.credentials.access_token ){
		res.redirect('/getLastMail')
	}
	else{
		res.redirect(url)
	}
})

// redirect url for granted  access
app.get('/auth/google/callback', function (req, res) {

	const { code } = req.query
	oauth2Client.getToken(code, function (err, tokens) {		
		console.log( tokens )
		// Now tokens contains an access_token and an optional refresh_token. Save them.
		fs.writeFileSync( path.join(__dirname, 'data', 'token'), tokens.refresh_token )
		if (!err) {
			oauth2Client.setCredentials(tokens);
		}		
		res.sendFile( path.join(__dirname, 'html', 'success.html') )
	});
	
})


// Test to get a user > messages > first message > parse the body
app.get('/getLastMail', async function (req, res) {
	try{	
		const user = await getUser() 		
		const messageList = await getMessageList( user.id )
		const message = await getMessage( user.id, messageList.messages[0].id )
		const content = Buffer.from( message.payload.parts[0].body.data, 'base64' );
		res.send( content.toString() )
	}
	catch(error){
		console.log( error )
		res.send( 'Server error' + error )	
	}
})

app.listen(process.env.PORT || 8080)


// provide authentication
const getHeaders = () => ({
	Authorization: 'Bearer ' + oauth2Client.credentials.access_token
})


// modular async rest apis
async function getUser(){
	const headers = getHeaders()
	const userResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', { headers } )
	const userText = await userResponse.text()
	const user = JSON.parse( userText )
	return user
}

async function getMessageList( userId ){	
	const headers = getHeaders()
	const messagesResponse = await fetch('https://www.googleapis.com/gmail/v1/users/' + userId + '/messages', { headers } )
	const messagesText = await messagesResponse.text()
	const messages = JSON.parse( messagesText )		
	return messages
	
}

async function getMessage( userId, messageId ){
	const headers = getHeaders()
	const messageResponse = await fetch('https://www.googleapis.com/gmail/v1/users/' + userId + '/messages/' + messageId , { headers } )
	const messageText = await messageResponse.text()	
	const message = JSON.parse( messageText )
	return message
}



