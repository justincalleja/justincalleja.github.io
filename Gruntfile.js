module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    watch: {
      sourceFilesNoClean: {
        options: {
          livereload: true
        },
        // files: ['themes/**','scaffolds/**','scripts/**','source/**','app.js'],
        files: ['source/**'],
        tasks: 'shell:hexoGen'
      },
      sourceFiles: {
        options: {
          livereload: true
        },
        files: ['source/**'],
        tasks: ['shell:hexoClean', 'shell:hexoGen']
      },
    },

    shell: {
      cleanPublic: {
        command: 'rm -rf public'
      },
      hexoGen: {
        command: 'hexo generate'
      }
    },

    connect: {
      server: {
        options: {
          base: 'public',
          hostname: '*',
          livereload: true
        }
      }
    },

  });

  // Default task.
  grunt.registerTask('default', ['connect', 'watch:sourceFilesNoClean']);
  grunt.registerTask('withClean', ['connect', 'watch:sourceFiles']);

};
