var program = require('commander');
const inquirer = require('inquirer');
const chalkPipe = require('chalk-pipe')
const Conf = require('conf');
const SpotifyWebApi = require('spotify-web-api-node');
const got = require('got');
require('dotenv').config()

const config = new Conf()

let token = config.get('token');
const query = {}

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  token,
});

const prompt = [
  {
    type: 'input',
    message: 'Username',
    name: 'username',
    default: config.get('username'),
    transformer: (userInput) => chalkPipe('green')(userInput)
  },
  {
    type: 'input',
    message: 'OAuth Token',
    name: 'token',
    transformer: (userInput) => chalkPipe('green')(userInput)
  }
]

const setUp = () => {
  return new Promise((resolve, reject) => {
    inquirer
      .prompt(prompt)
      .then(function (answers) {
        config.set(answers)
        resolve(true);
      }).catch(err => reject(err));
  })
}

program
  .command('create <artist>')
  .option('-n, --name <s>', 'Name of the playlist')
  .option('-l, --limit <i>', 'Limit to number of similar artist', parseInt)
  .option('-s, --songs <i>', 'Limit to number of songs per artist', parseInt)
  .action((artist, options) => {
    query.artist = artist
    query.limit = typeof options.limit === 'number' ? options.limit : 10;
    query.songs = typeof options.songs === 'number' ? options.limit : 10;
    query.playlistName = typeof options.name === 'string' ? options.name : `WHAT ${artist}`;
    setUp()
      .then(() => {
        spotifyApi.setAccessToken(token)
      })
      .then(() => {
        discoverify();
      })
  })

program
  .command('reset')
  .action(() => setUp())

program.parse(process.argv)

const discoverify = async () => {
  // create playlist with given name or default name
  return spotifyApi.createPlaylist(config.get('username'), query.playlistName, { public: true })
    .then((data) => {
      playlistId = data.body.id
      // search for artist
      return spotifyApi.searchArtists(query.artist)
    })
    .then(data => {
      // get first artist that matches the search word and return related artists
      const id = data.body.artists.items[0].id
      return spotifyApi.getArtistRelatedArtists(id)
    })
    .then(data => {
      console.log('getArtistRelatedArtists', data)
      // get top track from every related artist
      return Promise.all(data.body.artists.map(item => {
        return spotifyApi.getArtistTopTracks(item.id, 'DE')
      }))
    })
    .then(data => {
      // flatten top tracks from all artist to array
      const ids = []
      data
        .slice(0, query.limit) // respect limit set by user for max ARTISTS
        .forEach(element => {
          element.body.tracks
            .slice(0, query.songs) // respect limit set by user for max SONGS PER ARTIST
            .forEach(item => ids.push(item.uri))
        })
      return ids
    })
    .then(data => {
      // add frist 100 songs to playlist
      const options = {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ // have to manually stringify object in body
          uris: data.slice(0, 100)
        })
      }
      return got.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, options)
    })
    .then(data => {
      console.log('Added tracks to playlist', query.playlistName)
    })
    .catch((error) => {
      console.error('oops, something went wrong', error);
    })
}