const dotenv = require('dotenv').config();

if (dotenv.error) {
    throw dotenv.error;
}

const chai = require('chai');
const expect = chai.expect;

const rewire = require('rewire');

const nock = require('nock');
const td = require('testdouble');

const {
    LABEL_IDS,
    MAX_RESULTS,
    GMAIL_THREADS_ENDPOINT
} = require('../../../config/init.config');

const accessToken = 'accessToken';
const pageToken = 'pageToken';
let threads_ids;

let threadsFixture_1_Token = require('../fixtures/threads-page1-token.json');
let threadsFixture_2_Token = require('../fixtures/threads-page2-token.json');
let threadsFixture_3_NoToken = require('../fixtures/threads-page3-no-token.json');




describe('thread_ids.controller: ', () => {
    describe('uniqueThreadId: ', () => {
        beforeEach(() => {
            threads_ids = rewire('../../threads_ids.controller');
        });
        afterEach(() => {
            threads_ids = undefined;
        });
        it('should have uniqueThreadId()', () => {
            expect(threads_ids.__get__('uniqueThreadId')).to.exist;
        });
        it('should return true if the threadId is not in storedResults', () => {
            let uniqueThreadIdFunc = threads_ids.__get__('uniqueThreadId')
            let storedResults = ['threadId1', 'threadId2', 'threadId3', 'threadId4']
            let uniqueThreadId = uniqueThreadIdFunc('threadId5', storedResults);
            expect(uniqueThreadId).to.eql(true);
        });
        it('should return false if the threadId is in storedResults', () => {
            let uniqueThreadIdFunc = threads_ids.__get__('uniqueThreadId')
            let storedResults = ['threadId1', 'threadId2', 'threadId3', 'threadId4']
            let uniqueThreadId = uniqueThreadIdFunc('threadId2', storedResults);
            expect(uniqueThreadId).to.eql(false);
        });
    });
    describe('getPages: ', () => {
    describe('with 3 pages of threads and no storedResults: ', () => {
        let userObj;
        let storedResults;
        let nextPageToken;
        let pageNumber;
        let threadIdCount;
        let getPages;
        let explainPublish;
        let explainUpload;
        let explainUploadMeta;

        let threadsLibs;
        let explainLibs;

        let threadIds1 = threadsFixture_1_Token.threads.map((thread) => thread.id);
        let threadIds2 = threadsFixture_2_Token.threads.map((thread) => thread.id);
        let threadIds3 = threadsFixture_3_NoToken.threads.map((thread) => thread.id);
        let totalThreadIds = threadIds1.concat(threadIds2).concat(threadIds3);
        before(async () => {


            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
            })
            .reply(200, threadsFixture_1_Token);

            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
                pageToken: '11672757349790987449'
            })
            .reply(200, threadsFixture_2_Token);
            
            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
                pageToken: '15288356715195304524'
            })
            .reply(200, threadsFixture_3_NoToken);
            let publishThreadIds = td.replace('../../../libs/rabbit-utils/publishThread_IDs');
            let uploadThreadIdsMeta = td.replace('../../../libs/mongoose-utils/uploadThread_IDs_Meta');
            let uploadThreadIds = td.replace('../../../libs/mongoose-utils/uploadThread_IDs');
            // let threadsLibs = td.replace('../../../libs/threads.libs');
            // explainLibs = td.explain(threadsLibs);

            let threads_ids = rewire('../../threads_ids.controller');
            userObj = {
                userId: 'userId',
                accessToken: 'accessToken'
            }
            storedResults = [];
            nextPageToken;
            pageNumber = 0;
            threadIdCount = 0;
            let getPagesFunc = threads_ids.__get__('getPages');
            getPages = await getPagesFunc(userObj, storedResults, nextPageToken, pageNumber, threadIdCount);
            explainPublish = td.explain(publishThreadIds);
            explainUpload = td.explain(uploadThreadIds);
            explainUploadMeta = td.explain(uploadThreadIdsMeta);
        });
        after(() => {
            nock.cleanAll();
            td.reset();
        })
        it('should have getPageOfThreads', () => {
            expect(threads_ids.__get__('getPageOfThreads')).to.exist;
        });
        it('should get 3 pages of threads and return the total threadIdCount correctly', () => {
            expect(getPages).to.eql(totalThreadIds.length);
        });
        it('should call publishThreadIds 3 times', () => {
            console.log(explainLibs);
            expect(explainPublish.callCount).to.eql(3);
        });
        it('should call publishThreadIds with the correct args the first time', () => {
            expect(explainPublish.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainPublish.calls[0].args[1]).to.eql(userObj.accessToken);
            expect(explainPublish.calls[0].args[2]).to.eql(threadIds1);
            expect(explainPublish.calls[0].args[3]).to.eql(0);
            expect(explainPublish.calls[0].args[4]).to.eql(false);
        });
        it('should call publishThreadIds with the correct args the second time', () => {
            expect(explainPublish.calls[1].args[0]).to.eql(userObj.userId);
            expect(explainPublish.calls[1].args[1]).to.eql(userObj.accessToken);
            expect(explainPublish.calls[1].args[2]).to.eql(threadIds2);
            expect(explainPublish.calls[1].args[3]).to.eql(1);
            expect(explainPublish.calls[1].args[4]).to.eql(false);
        });
        it('should call publishThreadIds with the correct args the third time', () => {
            expect(explainPublish.calls[2].args[0]).to.eql(userObj.userId);
            expect(explainPublish.calls[2].args[1]).to.eql(userObj.accessToken);
            expect(explainPublish.calls[2].args[2]).to.eql(threadIds3);
            expect(explainPublish.calls[2].args[3]).to.eql(2);
            expect(explainPublish.calls[2].args[4]).to.eql(true);
        });
        it('should call uploadThreadIds 3 times', () => {
            expect(explainUpload.callCount).to.eql(3);
        });
        it('should call uploadThreadIds with the correct args the first time', () => {
            expect(explainUpload.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainUpload.calls[0].args[1]).to.eql(threadIds1);
        });
        it('should call uploadThreadIds with the correct args the second time', () => {
            expect(explainUpload.calls[1].args[0]).to.eql(userObj.userId);
            expect(explainUpload.calls[1].args[1]).to.eql(threadIds2);
        });
        it('should call uploadThreadIds with the correct args the third time', () => {
            expect(explainUpload.calls[2].args[0]).to.eql(userObj.userId);
            expect(explainUpload.calls[2].args[1]).to.eql(threadIds3);
        });
/*         it('should call uploadThreadIdsMeta 1 time', () => {
            expect(explainUploadMeta.callCount).to.eql(1);
        });
        it('should call uploadThreadIdsMeta with the correct args', () => {
            expect(explainUploadMeta.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainUploadMeta.calls[0].args[1]).to.eql(totalThreadIds.length);
            expect(explainUploadMeta.calls[0].args[2]).to.eql(MAX_RESULTS);
        }); */
    });
    describe('with 1 page of threads and no storedResults: ', () => {
        let userObj;
        let storedResults;
        let nextPageToken;
        let pageNumber;
        let threadIdCount;
        let getPages;
        let explainPublish;
        let explainUpload;
        let explainUploadMeta;

        let threadIds3 = threadsFixture_3_NoToken.threads.map((thread) => thread.id);
        before(async () => {
            
            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
            })
            .reply(200, threadsFixture_3_NoToken);
    
            let publishThreadIds = td.replace('../../../libs/rabbit-utils/publishThread_IDs');
            let uploadThreadIdsMeta = td.replace('../../../libs/mongoose-utils/uploadThread_IDs_Meta');
            let uploadThreadIds = td.replace('../../../libs/mongoose-utils/uploadThread_IDs');
            let threads_ids = rewire('../../threads_ids.controller');
            userObj = {
                userId: 'userId',
                accessToken: 'accessToken'
            }
            storedResults = [];
            nextPageToken;
            pageNumber = 0;
            threadIdCount = 0;
            let getPagesFunc = threads_ids.__get__('getPages');
            getPages = await getPagesFunc(userObj, storedResults, nextPageToken, pageNumber, threadIdCount);
            explainPublish = td.explain(publishThreadIds);
            explainUpload = td.explain(uploadThreadIds);
            explainUploadMeta = td.explain(uploadThreadIdsMeta);
        });
        after(() => {
            nock.cleanAll();
            td.reset();
        })
        it('should get 1 pages of threads and return the total threadIdCount correctly', () => {
            expect(getPages).to.eql(threadIds3.length);
        });
        it('should call publishThreadIds 1 times', () => {
            expect(explainPublish.callCount).to.eql(1);
        });
        it('should call publishThreadIds with the correct args', () => {
            expect(explainPublish.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainPublish.calls[0].args[1]).to.eql(userObj.accessToken);
            expect(explainPublish.calls[0].args[2]).to.eql(threadIds3);
            expect(explainPublish.calls[0].args[3]).to.eql(0);
            expect(explainPublish.calls[0].args[4]).to.eql(true);
        });
        it('should call uploadThreadIds 1 times', () => {
            expect(explainUpload.callCount).to.eql(1);
        });
        it('should call uploadThreadIds with the correct args', () => {
            expect(explainUpload.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainUpload.calls[0].args[1]).to.eql(threadIds3);
        });
/*         it('should call uploadThreadIdsMeta 1 time', () => {
            expect(explainUploadMeta.callCount).to.eql(1);
        });
        it('should call uploadThreadIdsMeta with the correct args', () => {
            expect(explainUploadMeta.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainUploadMeta.calls[0].args[1]).to.eql(threadIds3.length);
            expect(explainUploadMeta.calls[0].args[2]).to.eql(MAX_RESULTS);
        }); */
    });
    describe('with 3 pages of threads and 2 pages of storedResults: ', () => {
        let userObj;
        let storedResults;
        let nextPageToken;
        let pageNumber;
        let threadIdCount;
        let getPages;
        let explainPublish;
        let explainUpload;
        let explainUploadMeta;

        let threadIds1 = threadsFixture_1_Token.threads.map((thread) => thread.id);
        let threadIds2 = threadsFixture_2_Token.threads.map((thread) => thread.id);
        let threadIds3 = threadsFixture_3_NoToken.threads.map((thread) => thread.id);
        let totalThreadIds = threadIds1.concat(threadIds2).concat(threadIds3);
        before(async () => {


            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
            })
            .reply(200, threadsFixture_1_Token);

            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
                pageToken: '11672757349790987449'
            })
            .reply(200, threadsFixture_2_Token);
            
            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
                pageToken: '15288356715195304524'
            })
            .reply(200, threadsFixture_3_NoToken);
    
            let publishThreadIds = td.replace('../../../libs/rabbit-utils/publishThread_IDs');
            let uploadThreadIdsMeta = td.replace('../../../libs/mongoose-utils/uploadThread_IDs_Meta');
            let uploadThreadIds = td.replace('../../../libs/mongoose-utils/uploadThread_IDs');
            let threads_ids = rewire('../../threads_ids.controller');
            userObj = {
                userId: 'userId',
                accessToken: 'accessToken'
            }
            storedResults = threadIds2.concat(threadIds3);
            nextPageToken;
            pageNumber = 0;
            threadIdCount = 0;
            let getPagesFunc = threads_ids.__get__('getPages');
            getPages = await getPagesFunc(userObj, storedResults, nextPageToken, pageNumber, threadIdCount);
            explainPublish = td.explain(publishThreadIds);
            explainUpload = td.explain(uploadThreadIds);
            explainUploadMeta = td.explain(uploadThreadIdsMeta);
        });
        after(() => {
            nock.cleanAll();
            td.reset();
        })
        it('should get 3 pages of threads and return the total threadIdCount correctly', () => {
            expect(getPages).to.eql(threadIds1.length);
        });
        it('should call publishThreadIds 3 times', () => {
            expect(explainPublish.callCount).to.eql(3);
        });
        it('should call publishThreadIds with the correct args the first time', () => {
            expect(explainPublish.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainPublish.calls[0].args[1]).to.eql(userObj.accessToken);
            expect(explainPublish.calls[0].args[2]).to.eql(threadIds1);
            expect(explainPublish.calls[0].args[3]).to.eql(0);
            expect(explainPublish.calls[0].args[4]).to.eql(false);
        });
        it('should call publishThreadIds with the correct args the second time', () => {
            expect(explainPublish.calls[1].args[0]).to.eql(userObj.userId);
            expect(explainPublish.calls[1].args[1]).to.eql(userObj.accessToken);
            expect(explainPublish.calls[1].args[2]).to.eql([]);
            expect(explainPublish.calls[1].args[3]).to.eql(1);
            expect(explainPublish.calls[1].args[4]).to.eql(false);
        });
        it('should call publishThreadIds with the correct args the third time', () => {
            expect(explainPublish.calls[2].args[0]).to.eql(userObj.userId);
            expect(explainPublish.calls[2].args[1]).to.eql(userObj.accessToken);
            expect(explainPublish.calls[2].args[2]).to.eql([]);
            expect(explainPublish.calls[2].args[3]).to.eql(2);
            expect(explainPublish.calls[2].args[4]).to.eql(true);
        });
        it('should call uploadThreadIds 3 times', () => {
             expect(explainUpload.callCount).to.eql(3);
        });
        it('should call uploadThreadIds with the correct args the first time', () => {
            expect(explainUpload.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainUpload.calls[0].args[1]).to.eql(threadIds1);
        });
        it('should call uploadThreadIds with the correct args the second time', () => {
            expect(explainUpload.calls[1].args[0]).to.eql(userObj.userId);
            expect(explainUpload.calls[1].args[1]).to.eql([]);
        });
/*         it('should call uploadThreadIdsMeta 1 time', () => {
             expect(explainUploadMeta.callCount).to.eql(1);
        });
        it('should call uploadThreadIdsMeta with the correct args', () => {
            expect(explainUploadMeta.calls[0].args[0]).to.eql(userObj.userId);
            expect(explainUploadMeta.calls[0].args[1]).to.eql(threadIds1.length);
            expect(explainUploadMeta.calls[0].args[2]).to.eql(MAX_RESULTS);
        }); */
    });
    });
    describe('3 pages of threads, no storedResults, 1 error on page 1, 2 errors on page 2, 3 errors on page 3: ', () => {
        let userObj;
        let storedResults;
        let nextPageToken;
        let pageNumber;
        let threadIdCount;
        let getPages;
        let explainPublish;
        let explainUpload;
        let explainUploadMeta;

        let threadIds1 = threadsFixture_1_Token.threads.map((thread) => thread.id);
        let threadIds2 = threadsFixture_2_Token.threads.map((thread) => thread.id);
        let threadIds3 = threadsFixture_3_NoToken.threads.map((thread) => thread.id);
        let totalThreadIds = threadIds1.concat(threadIds2).concat(threadIds3);
        before(async () => {
            
            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
            })
            .replyWithError('Test Error');


             nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
            })
            .reply(200, threadsFixture_1_Token);

            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .times(2)
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
                pageToken: '11672757349790987449'
            })
            .replyWithError('Test Error');
            
            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
                pageToken: '11672757349790987449'
            })
            .reply(200, threadsFixture_2_Token);

            nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .times(3)
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
                pageToken: '15288356715195304524'
            })
            .replyWithError('Test Error');

             nock('https://www.googleapis.com')
            .get('/gmail/v1/users/me/threads')
            .query({
                maxResults: '500',
                labelIds: 'INBOX',
                pageToken: '15288356715195304524'
            })
            .reply(200, threadsFixture_3_NoToken);
    
            let publishThreadIds = td.replace('../../../libs/rabbit-utils/publishThread_IDs');
            let uploadThreadIdsMeta = td.replace('../../../libs/mongoose-utils/uploadThread_IDs_Meta');
            let uploadThreadIds = td.replace('../../../libs/mongoose-utils/uploadThread_IDs');
            let threads_ids = rewire('../../threads_ids.controller');
            userObj = {
                userId: 'userId',
                accessToken: 'accessToken'
            }
            storedResults = [];
            nextPageToken;
            pageNumber = 0;
            threadIdCount = 0;
            let getPagesFunc = threads_ids.__get__('getPages');
            getPages = await getPagesFunc(userObj, storedResults, nextPageToken, pageNumber, threadIdCount);
            explainPublish = td.explain(publishThreadIds);
            explainUpload = td.explain(uploadThreadIds);
            explainUploadMeta = td.explain(uploadThreadIdsMeta);
        });
        after(() => {
            nock.cleanAll();
            td.reset();
        })
        it('should get 3 pages of threads and return the total threadIdCount correctly', () => {
            expect(getPages).to.eql(1409);
        });
        it('should call publishThreadIds 3 times', () => {
            expect(explainPublish.callCount).to.eql(3);
        });
/*         it('should call uploadThreadIdsMeta 1 time', () => {
            expect(explainUploadMeta.callCount).to.eql(1);
        }); */
        it('should call uploadThreadIds 3 times', () => {
            expect(explainUpload.callCount).to.eql(3);
        });
    });
});

