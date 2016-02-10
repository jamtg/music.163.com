var playlist = new Array();
var playingid = 0;
var lastlogid = 0;
var chkst, chkdr;
var playing = false;
var playmode = 'all';
var rndlst = new Array();
var sound = 1;
var urls = {
	id:[],
	url:[]
};
var songs = new Array();

setHeaders({
	"urls": [
		"*://music.163.com/*",
		"*://*.music.126.net/*"
	],
	"headers": [
		{"name": "referer", "value": "http://music.163.com/"}
	]
});

setTimeout(function(){
	chrome.storage.sync.get('list', function(list){
		if(list && list.list){
			playlist = list.list;
			rndlst = mkrandomlist();
			api.songurls(playlist);
		}
	});

	chrome.storage.sync.get('mode', function(mode){
		if(mode && mode.mode){
			playmode = mode.mode;
		}
	});
},100);

window.onerror = function(){
	setTimeout(function(){window.location.reload();}, 1000);
}

var 比较播放顺序 = function(a, b){
	if (a == b) return 0;
	return playlist.indexOf(a.id) > playlist.indexOf(b.id) ? 1 : -1;
};

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse){
		if(request.action == 'pause'){
			api.songlog(true);
			playing = false;
			document.getElementById('song').pause();
		}
		else if(request.action == 'play'){
			if(!playingid) return playnext(true);
			playing = true;
			document.getElementById('song').play();
		}
		else if(request.action == 'next'){
			playnext(true);
		}
		else if(request.action == 'list'){
			chrome.runtime.sendMessage({b_list: songs.sort(比较播放顺序), p_list: playlist, playingid: playingid});
		}
		else if(request.action == 'update'){
			songs = new Array();
			api.songurls(playlist);
		}
		else if(request.mode){
			playmode = request.mode;
			chrome.storage.sync.set({'mode': playmode});
		}
		else if(request.song){
			api.songlog(true);
			playing = true;
			addtolist([request.song], function(){
				api.song(request.song);
				chrome.runtime.sendMessage({action: 'playlist'});
				clearTimeout(chkdr);
				chkdr = setTimeout(chkended, 500);
			});
		}
		else if(request.play){
			api.songlog(true);
			playing = true;
			addtolist([request.play], function(){
				api.song(request.play);
				clearTimeout(chkdr);
				chkdr = setTimeout(chkended, 500);
			});
		}
		else if(request.action == 'isplaying'){
			sendResponse({'playing': playing, 'mode': playmode, 'sound': sound});
		}
		else if(request.sound){
			sound = request.sound;
			document.getElementById('song').volume = sound;
		}
		else if(request.remove){
			if(request.remove == playingid) api.songlog(true);
			delfromlist(request.remove);
			chrome.runtime.sendMessage({action: 'playlist'});
		}
		else if(request.add){
			addtolist(request.add);
		}
		else if(request.action == 'stop'){
			playing = false;
			document.getElementById('song').pause();
			document.getElementById('song').currentTime = 0;
		}
});

/*
document.getElementById('song').onended = function(){
	playingid = 0;
	chrome.runtime.sendMessage({action: 'ended'});
	console.log('ended');
}
*/

function mkrandomlist(){
	var randomlist = new Array();
	var seed = Math.floor(playlist.length*(1+Math.random()));
	var tmplist = new Array();
	var tmplistindex;
	for(var i=0; i<playlist.length; i++){
		tmplist.push(playlist[i]);
	}
	for(var i=0; i<playlist.length; i++){
		tmplistindex = seed%tmplist.length
		randomlist.push(tmplist[tmplistindex]);
		tmplist.splice(tmplistindex, 1);
	}
	return randomlist;
}

function playnext(manual){
	api.songlog(manual);
	if(!playlist.length){
		playingid = 0;
		playing = false;
		chrome.runtime.sendMessage({action: 'ended'});
		document.getElementById('song').pause();
		document.getElementById('song').src = '';
		return;
	}
	var listindex = playlist.indexOf(playingid);
	if(listindex == -1 && playingid){
		listindex = 0;
	}
	switch(playmode){
		case 'all':{
			listindex++;
			if(listindex >= playlist.length){
				listindex = 0;
			}
			break;
		}
		case 'random':{
			var rndindex = rndlst.indexOf(playingid);
			rndindex++;
			if(rndindex >= rndlst.length){
				rndlst = mkrandomlist();
				listindex = playlist.indexOf(rndlst[0]);
			}
			else{
				listindex = playlist.indexOf(rndlst[rndindex]);
			}
			break;
		}
		default :{
			if(manual){
				listindex++;
				if(!playlist[listindex]){
					listindex = 0;
				}
			}
		}
	}
	playingid = playlist[listindex];
	playing = true;
	api.song(playingid);
	chrome.runtime.sendMessage({action: 'playnext', playingid: playingid});
	clearTimeout(chkdr);
	chkdr = setTimeout(chkended, 500);
}

function chkended(){
	if(document.getElementById('song').ended){
		//playingid = 0;
		//playing = false;
		//chrome.runtime.sendMessage({action: 'ended'});
		playnext();
	}
	else{
		clearTimeout(chkst);
		chkst = setTimeout(chkended, 500);
	}
}

function addtolist(ids, callback){
	var newlist = new Array();
	for(var i in ids){
		id = Number(ids[i]);
		if(playlist.indexOf(id) == -1 && !isNaN(id)){
			playlist.push(id);
			newlist.push(id);
		}
	}
	if(newlist.length >0){
		chrome.storage.sync.set({'list':playlist});
		rndlst = mkrandomlist();
		api.songurls(newlist, 0, callback);
	}
	else{
		callback && callback();
	}
}

function delfromlist(id){
	if(id == 'all'){
		playlist = new Array();
		rndlst = new Array();
		songs = new Array();
		chrome.storage.sync.set({'list':playlist});
		playnext(true);
		return;
	}
	else{
		id = Number(id);
	}
	if(playingid == id) {
		playnext(true);
	}
	if(playlist.indexOf(id) != -1){
		playlist.splice(playlist.indexOf(id), 1);
		rndlst.splice(rndlst.indexOf(id), 1);
		chrome.storage.sync.set({'list':playlist});
	}
	for(var i in songs){
		if(songs[i].id == id){
			songs.splice(i, 1);
		}
	}
}

var api = {
	httpRequest: function(method, action, query, urlencoded, callback, timeout){
		var url = "GET" == method ? (query ? action+"?"+query : action) : action;
		var timecounter;

		if(this.debug){
			this.outputDebug("httpRequest: method("+method+") action("+action+") query("+query+") urlencoded("+(urlencoded?1:0)+")");
		}

		var xhr = new XMLHttpRequest();
		xhr.open(method, url, true);
		if("POST" == method && urlencoded){
			xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		}
		xhr.onreadystatechange = function() {
		  if (xhr.readyState == 4) {
		  	if(timecounter){
		  		clearTimeout(timecounter);
		  	}
		  	if(this.debug){
		  		this.outputDebug(xhr.responseText);
		  	}
		  	if(callback){
		    	callback(xhr.responseText);
		    }
		  }
		}
		xhr.addEventListener('error', function(){callback(-1)}, false);
		xhr.addEventListener('abort', function(){callback(-2)}, false);
		if("POST" == method && query){
			xhr.send(query);
		}
		else{
			xhr.send();
		}
		if(timeout){
			timecounter = setTimeout(function(){
				if(xhr.readyState != 4){
					xhr.abort();
				}
			}, timeout);
		}
	},
	refresh_csrf: function(){
		var url = 'http://music.163.com/api/login/token/refresh?csrf_token=';
		api.httpRequest('POST', url, '', true, function(r){
			console.log(r);
		}, 5000);
	},
	song: function(id){
		id = Number(id);
		playingid = id;
		if(urls.id.indexOf(id) != -1){
			var audio = document.getElementById('song');
			audio.src = urls.url[urls.id.indexOf(id)];
			audio.play();
			return;
		}
		var url = 'http://music.163.com/api/song/detail?ids=['+id+']';
		this.httpRequest('GET', url, null, false, function(result){
			if(result == -1){
				return;
			}
			else if(result == -2){
				return;
			}
			else{
				result = JSON.parse(result);
				songs.push(result.songs[0]);
				urls.id.push(id);
				urls.url.push(result.songs[0].mp3Url);
				var audio = document.getElementById('song');
				audio.src = result.songs[0].mp3Url;
				audio.play();
			}
		}, 5000);
	},
	songlog: function(manual){
		if(!playingid) return;
		if(lastlogid == playingid && playlist.length > 1 && playmode != 'one') return;
		lastlogid = playingid;
		var url = 'http://music.163.com/api/log/web?csrf_token=';
		var secs = song.currentTime;
		//secs = secs > 1 ? secs - 1 : 0;
		var j = encodeURIComponent(JSON.stringify(
			{
				"type":"song",
				"wifi": 0,
				"download": 0,
				"id": playingid,
				"time": parseInt(secs),
				"end": manual ? 'ui' : 'playend' // playend, ui, interrupt
				// "source": "list","sourceId": 歌单编号
			}
		));
		this.httpRequest('POST', url, 'action=play&json='+j, true, function(result){
			if(result == -1 || result == -2) return;
			var r = JSON.parse(result || '{}');
			console && console.log(lastlogid + '\t' + secs + '\t' + (manual ? 'ui' : 'playend') + '\t' + result);
			if(r.code == 200) {
				chrome.browserAction.setBadgeText({text: ''});
				chrome.browserAction.setTitle({title: '网易云音乐'});
			} else {
				chrome.browserAction.setBadgeText({text: 'x'});
				chrome.browserAction.setTitle({title: '播放记录上报异常，请检查网络'});
			}
		}, 1000*20);
	}, //songlog
	songurls: function(ids, offset, callback){
		if(!offset){
			offset = 0;
		}
		var tmpids = new Array();
		for(var i=0; i<100 && i+offset<ids.length; i++){
			tmpids.push(ids[i+offset]);
		}
		var url = 'http://music.163.com/api/song/detail?ids=['+tmpids.join(',')+']';
		this.httpRequest('GET', url, null, false, function(result){
			if(result == -1){
				return;
			}
			else if(result == -2){
				return;
			}
			else{
				result = JSON.parse(result);
				for(var i in result.songs){
					songs.push(result.songs[i]);
					urls.id.push(result.songs[i].id);
					urls.url.push(result.songs[i].mp3Url);
				}
			}
			if(offset+100<ids.length){
				api.songurls(ids, offset+100);
			}
			else if(callback){
				callback();
			}
		}, 5000);
	}
};

function setHeaders(options){
	chrome.webRequest.onBeforeSendHeaders.addListener(function(details){
		for(var i in options.headers){
			var setheader = false
			for(var j in details.requestHeaders){
				if (details.requestHeaders[j].name.toLowerCase() == options.headers[i].name) {  
					details.requestHeaders.splice(j, 1);
					break;
				}
			}
			details.requestHeaders.push({name: options.headers[i].name, value: options.headers[i].value});
		}
		return {requestHeaders: details.requestHeaders};
	},{urls: options.urls},["requestHeaders", "blocking"]);
}
