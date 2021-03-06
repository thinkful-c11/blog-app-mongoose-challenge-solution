const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);
chai.use(require('chai-moment'));
function seedBlogData() {
  console.info('seeding blog data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogData());
  }
  return BlogPost.insertMany(seedData);
}

function generateBlogData() {
  return {
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName()
    },
    title: faker.lorem.word(),
    content: faker.lorem.paragraph(),
    created: new Date()
  };
}

function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

function getAuthorName(obj){
  return `${obj.author.firstName} ${obj.author.lastName}`.trim();
}

describe('Blog Post API resource', function() {


  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  describe('Get endpoint', function() {

    it('should return all existing blog posts', function() {
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          res = _res;
          res.should.have.status(200);
          res.body.should.have.length.of.at.least(1);
          return BlogPost.count();
        })
        .then(function(count) {
          res.body.should.have.lengthOf(count);
        });
    });

    it('should return blog posts with right fields', function () {
      let resPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);

          res.body.forEach(function(post) {
            post.should.be.a('object');
            post.should.include.keys(
              'id', 'title', 'author', 'content', 'created');
          });
          resPost = res.body[0];
          return BlogPost.findById(resPost.id);
        })
        .then(function(post) {

          resPost.id.should.equal(post.id);
          resPost.title.should.equal(post.title);
          resPost.author.should.equal(post.authorName);
          resPost.created.should.be.sameMoment(post.created);
        });
    });
  });

  describe('POST endpoint', function() {

    it('should add a new blog post', function() {

      const newPost = generateBlogData();
      const _authorName = `${newPost.author.firstName} ${newPost.author.lastName}`.trim();
      let responseDate;

      return chai.request(app)
        .post('/posts')
        .send(newPost)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'title', 'author', 'content', 'created');
          res.body.id.should.not.be.null;
          res.body.title.should.equal(newPost.title);
          res.body.author.should.equal(_authorName);
          res.body.content.should.equal(newPost.content);

          responseDate = res.body.created;
          return BlogPost.findById(res.body.id);
        })
        .then(function(post) {
          const postAuthor = getAuthorName(post);
          const newAuthor = getAuthorName(newPost);
          
          post.title.should.equal(newPost.title);
          postAuthor.should.equal(newAuthor);
          post.content.should.equal(newPost.content);
          // Testing created field on db vs. on res obj.
          post.created.should.be.sameMoment(responseDate);
        });
    });
  });

  describe('PUT endpoint', function() {

    it('should update field you send over', function() {
      const updateData = {
        title: 'fofofofofofof',
        author: {
          firstName: 'blah',
          lastName: 'blergh'
        },
        content: 'hahahahahahahahahahahahaha'
      };

      return BlogPost
       .findOne()
       .exec()
       .then(function(post) {
         updateData.id = post.id;

         return chai.request(app)
           .put(`/posts/${post.id}`)
           .send(updateData);
       })
       .then(function(res) {
         res.should.have.status(204);
         return BlogPost.findById(updateData.id).exec();
       })
       .then(function(post) {
         const postAuthor = getAuthorName(post);
         const updateAuthor = getAuthorName(updateData);
         post.title.should.equal(updateData.title);
         postAuthor.should.equal(updateAuthor);
         post.content.should.equal(updateData.content);
       });
    });
  });

  describe('DELETE endpoint', function() {

    it('delete a blog post by id', function() {

      let blogPost;

      return BlogPost
        .findOne()
        .exec()
        .then(function(_blogPost) {
          blogPost = _blogPost;
          return chai.request(app).delete(`/posts/${blogPost.id}`);
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(blogPost.id).exec();
        })
        .then(function(_blogPost) {
          should.not.exist(_blogPost);
        });
    });
  });

});
