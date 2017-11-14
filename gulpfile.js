const gulp = require("gulp");
const babel = require("gulp-babel");

gulp.task("babel", () =>
    gulp.src(["src/**/*.js", "!src/**/*.test.js"])
        .pipe(babel())
        .pipe(gulp.dest("dist"))
);
