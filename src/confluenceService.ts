import { ConfluenceService, Cookies, Credentials } from './types';
import * as request from 'superagent';

export class ConfluenceServiceImpl implements ConfluenceService {

    public getContentbyCookies(URL: string, cookies: Cookies): Promise<JSON> {

        return new Promise<JSON>((resolve, reject) => {

            const serializedCookies = this.serializeCookies(cookies);

            request
                .get(URL)
                .type('application/json')
                .set('Cookie', serializedCookies)
                .end((err, res) => {
                    if (err) {
                        reject(err.message);
                    } else if (res && res.ok && res.header['content-type'] === 'application/json' && res.body) {
                        // console.log('Response from confluenceService:');
                        // console.log(res);
                        // console.log(JSON.stringify(res.body));
                        resolve(res.body);
                    } else {
                        console.log('-> rejecting manually in getContentbyCookies!!');
                        // Something went wrong with received data. If there are problems with authentication, a html-content/type response is given.
                        const sth = new Error('It\'s not possible to get info from \'' + URL + '\'' + '. Make sure you have authorization.');
                        reject(sth);
                        //reject('It\'s not possible to get info from \'' + URL + '\'' + '. Make sure you have authorization.');
                    }
                });
        });
    }

    public getContentbyCredentials(URL: string, credentials: Credentials): Promise<JSON> {

        return new Promise<JSON>((resolve, reject) => {

            request
                .get(URL)
                .type('application/json')
                .auth(credentials.username, credentials.password)
                .end((err: any, res: any) => {
                    if (err) {
                        // Something was wrong with the request
                        reject(err.message);
                    } else if (res && res.statusCode === 200 && res.headers['content-type'] === 'application/json' && res.body) {
                        // console.log('Response from confluenceService:');
                        // console.log(res);
                        // console.log(JSON.stringify(res.body));
                        resolve(res.body);
                    } else {
                        console.log('-> rejecting manually in getContentbyCredentials!');
                        // Something went wrong with the received data. If the there are problems with authentication, a html-content/type response is given.
                        reject(new Error('It\'s not possible to get info from \'' + URL + '\'' + '. Make sure you have authorization.'));
                    }
                });

        });
    }

    private serializeCookies(cookies: Cookies): string {

        let out = '';
        for (const myCookie of cookies) {
            out += `${myCookie.name}=${myCookie.value};`;
        }
        if (out.length > 0) {
            out = out.substring(0, out.length - 1);
        }
        return out;
    }

}

